import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import type { Server as HttpServer } from 'node:http';
import path from 'node:path';
import { config } from './config.js';
import { HttpError } from './lib/errors.js';
import { isIgnoredName } from './lib/files.js';
import { aiRouter } from './routes/ai.js';
import { filesRouter } from './routes/files.js';
import { gitRouter } from './routes/git.js';
import { systemRouter } from './routes/system.js';

/** Read an access token from the header, query string or bearer auth. */
function readToken(request: Request): string | null {
  const header = request.get('x-safari-token');
  if (header) return header;

  const authorization = request.get('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  const queryToken = request.query.token;
  return typeof queryToken === 'string' ? queryToken : null;
}

function tokenMatches(request: Request): boolean {
  if (!config.accessToken) return true;
  return readToken(request) === config.accessToken;
}

function authGuard(request: Request, response: Response, next: NextFunction): void {
  if (tokenMatches(request)) {
    next();
    return;
  }
  response.status(401).json({
    error:
      'Unauthorized. This server requires SAFARI_ACCESS_TOKEN; send it as x-safari-token or ?token=.',
  });
}

function previewGuard(request: Request, response: Response, next: NextFunction): void {
  if (!tokenMatches(request)) {
    response.status(401).type('text/plain').send('Unauthorized');
    return;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(request.path);
  } catch {
    response.status(400).type('text/plain').send('Bad request');
    return;
  }

  const blocked = decoded
    .split('/')
    .filter(Boolean)
    .some((segment) => isIgnoredName(segment, 'directory') || segment.startsWith('.git'));

  if (blocked) {
    response.status(404).type('text/plain').send('Not found');
    return;
  }

  next();
}

const EMPTY_PREVIEW_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Preview</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center;
             background: #0b0d10; color: #8b949e; font-family: system-ui, sans-serif; }
      .card { max-width: 420px; text-align: center; padding: 32px; }
      h1 { color: #d7dce3; font-size: 18px; margin: 0 0 12px; }
      p { font-size: 14px; line-height: 1.6; margin: 0; }
      code { background: #161b22; padding: 2px 6px; border-radius: 4px; color: #79c0ff; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Nothing to preview yet</h1>
      <p>Add an <code>index.html</code> to your workspace and refresh this panel.</p>
    </div>
  </body>
</html>`;

export interface CreateAppOptions {
  /** Passing the HTTP server lets Vite serve HMR over the same port. */
  hmrServer?: HttpServer;
}

export async function createApp(options: CreateAppOptions = {}): Promise<express.Express> {
  const app = express();
  app.disable('x-powered-by');

  app.use(express.json({ limit: config.limits.maxJsonBody }));

  app.use((_request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  // Unauthenticated liveness probe, safe to expose.
  app.get('/api/health', (_request, response) => {
    response.json({
      status: 'ok',
      version: config.version,
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  app.use('/api', authGuard);
  app.use('/api/files', filesRouter);
  app.use('/api/git', gitRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/system', systemRouter);

  app.use('/api', (_request, response) => {
    response.status(404).json({ error: 'Endpoint not found' });
  });

  // Static preview of the workspace.
  app.use('/preview', previewGuard);
  app.use(
    '/preview',
    express.static(config.workspaceDir, {
      dotfiles: 'ignore',
      index: ['index.html'],
      extensions: ['html'],
      fallthrough: true,
      redirect: false,
      setHeaders: (response) => {
        response.setHeader('Cache-Control', 'no-store');
      },
    }),
  );
  app.use('/preview', (_request, response) => {
    response.status(404).type('html').send(EMPTY_PREVIEW_HTML);
  });

  if (config.isProduction) {
    const distDir = path.join(config.root, 'dist');
    if (!fs.existsSync(path.join(distDir, 'index.html'))) {
      throw new Error(
        'Production build not found. Run `npm run build` before starting the server.',
      );
    }
    app.use(express.static(distDir, { index: false }));
    app.get('*', (_request, response) => {
      response.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // The IDE is often reached through a proxy/tunnel (preview URLs,
        // containers). Vite's host allow-list would reject those requests.
        allowedHosts: true,
        ...(options.hmrServer ? { hmr: { server: options.hmrServer } } : {}),
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const status = error instanceof HttpError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : 'Unexpected server error';

    if (status >= 500) {
      console.error('[api] unhandled error:', error);
    }

    if (response.headersSent) return;
    response.status(status).json({ error: message });
  });

  return app;
}
