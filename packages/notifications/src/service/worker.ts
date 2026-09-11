import { config } from 'dotenv';
import path from 'path';

import fs from 'fs';

// Load environment variables across possible monorepo locations
const envPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../apps/api/.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'apps/api/.env'),
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    config({ path: p });
  }
}

import { NotificationConsumer } from '../redis/notification.consumer';
import { checkRedisHealth, closeRedisClient } from '../redis/redis.connection';

async function bootstrap() {
  console.log('====================================================');
  console.log('  MaiHoonNa Notification Microservice Worker Daemon ');
  console.log('====================================================');

  const isHealthy = await checkRedisHealth();
  if (!isHealthy) {
    console.warn('⚠️  Warning: Initial Redis ping failed. Worker will continue with reconnect backoff...');
  } else {
    console.log('✅ Redis connection verified.');
  }

  const consumer = new NotificationConsumer();

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down worker gracefully...`);
    await consumer.stop();
    await closeRedisClient();
    console.log('Worker shutdown complete. Exiting.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await consumer.start();
  } catch (err: any) {
    console.error('Fatal worker crash:', err.message || err);
    process.exit(1);
  }
}

bootstrap();
