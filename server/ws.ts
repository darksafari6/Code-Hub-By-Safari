import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { config } from './config.js';
import { TerminalSession, type TerminalEvent } from './lib/terminal.js';

const HEARTBEAT_MS = 30_000;

function originAllowed(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

function tokenAllowed(request: IncomingMessage, url: URL): boolean {
  if (!config.accessToken) return true;

  const queryToken = url.searchParams.get('token');
  if (queryToken === config.accessToken) return true;

  const headerToken = request.headers['x-safari-token'];
  if (typeof headerToken === 'string' && headerToken === config.accessToken) return true;

  return false;
}

function reject(socket: Duplex, statusLine: string): void {
  socket.write(`HTTP/1.1 ${statusLine}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

/**
 * Terminal transport. One shell session per WebSocket, scoped to the
 * workspace, with a small JSON protocol:
 *
 *   client -> server: { type: 'exec', command } | { type: 'interrupt' }
 *   server -> client: TerminalEvent
 */
export function attachTerminalSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024 });

  server.on('upgrade', (request, socket, head) => {
    let url: URL;
    try {
      url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    } catch {
      reject(socket, '400 Bad Request');
      return;
    }

    if (url.pathname !== '/ws/terminal') {
      // Vite's HMR socket shares this server during development, so unknown
      // paths are left for other upgrade listeners instead of being destroyed.
      if (url.pathname.startsWith('/ws/')) reject(socket, '404 Not Found');
      return;
    }
    if (!originAllowed(request)) {
      reject(socket, '403 Forbidden');
      return;
    }
    if (!tokenAllowed(request, url)) {
      reject(socket, '401 Unauthorized');
      return;
    }

    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit('connection', client, request);
    });
  });

  wss.on('connection', (client: WebSocket) => {
    let alive = true;

    const send = (event: TerminalEvent) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(event));
      }
    };

    const session = new TerminalSession(send);
    session.start();

    client.on('pong', () => {
      alive = true;
    });

    const heartbeat = setInterval(() => {
      if (!alive) {
        client.terminate();
        return;
      }
      alive = false;
      try {
        client.ping();
      } catch {
        client.terminate();
      }
    }, HEARTBEAT_MS);
    heartbeat.unref?.();

    client.on('message', (raw) => {
      let payload: unknown;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        send({ type: 'error', message: 'Malformed terminal message' });
        return;
      }

      if (typeof payload !== 'object' || payload === null) return;
      const message = payload as { type?: unknown; command?: unknown };

      if (message.type === 'exec' && typeof message.command === 'string') {
        void session.run(message.command);
      } else if (message.type === 'interrupt') {
        session.interrupt();
      }
    });

    const cleanup = () => {
      clearInterval(heartbeat);
      session.dispose();
    };

    client.on('close', cleanup);
    client.on('error', cleanup);
  });

  return wss;
}
