import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './db/prisma';

const app = createApp();

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`✅ השרת פועל על פורט ${env.PORT}`);
  console.log(`   בדיקת בריאות: http://localhost:${env.PORT}/api/health`);
  console.log(`   Swagger:       http://localhost:${env.PORT}/api-docs`);
});

const shutdown = async (signal: string) => {
  console.log(`${signal} התקבל, סוגר את השרת...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
