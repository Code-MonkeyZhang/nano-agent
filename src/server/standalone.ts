import { getServerManager } from './index.js';

async function main() {
  const manager = getServerManager();

  const result = await manager.start({ enableTunnel: false });

  if (result.success) {
    console.log('Nano-Agent server started successfully');
    console.log(`Local URL: http://localhost:${manager.getPort()}`);

    const shutdown = () => {
      console.log('Shutting down server...');
      void manager.stop().then(() => {
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } else {
    console.error('Failed to start server:', result.error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Server startup error:', error);
  process.exit(1);
});
