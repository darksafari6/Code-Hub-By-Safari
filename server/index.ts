import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { attachTerminalSocket } from './ws.js';

async function main(): Promise<void> {
  const server = http.createServer();
  const app = await createApp({ hmrServer: server });
  server.on('request', app);
  const sockets = attachTerminalSocket(server);

  server.listen(config.port, config.host, () => {
    const mode = config.isProduction ? 'production' : 'development';
    console.log(`\n  Safari AI Dev Studio ${config.version} (${mode})`);
    console.log(`  Local:    http://localhost:${config.port}`);
    console.log(`  Network:  http://${config.host}:${config.port}`);
    console.log(`  Workspace: ${config.workspaceDir}`);
    if (config.accessToken) console.log('  Auth:     access token required');
    console.log('');
  });

  const shutdown = (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down…`);
    sockets.clients.forEach((client) => client.close());
    sockets.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('Failed to start Safari AI Dev Studio:', error);
  process.exit(1);
});
