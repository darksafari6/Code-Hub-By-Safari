// Production entry point. Kept as a tiny script so that `npm start` works on
// every platform without relying on shell-specific env syntax.
process.env.NODE_ENV = 'production';
await import('../dist-server/index.js');
