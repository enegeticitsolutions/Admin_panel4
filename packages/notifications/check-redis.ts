import path from 'path';
import fs from 'fs';
import Redis from 'ioredis';

// 1. Load environment variables across possible locations
const envPaths = [
  path.resolve(__dirname, '../../apps/api/.env'),
  path.resolve(__dirname, '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'apps/api/.env'),
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    require('dotenv').config({ path: p });
  }
}

const host = process.env.REDIS_HOST || '127.0.0.1';
const port = Number(process.env.REDIS_PORT) || 6379;
const password = process.env.REDIS_PASSWORD || undefined;

console.log('====================================================');
console.log('       MaiHoonNa Redis Infrastructure Healthcheck   ');
console.log('====================================================');
console.log(`Target: redis://${host}:${port}\n`);

const redis = new Redis({
  host,
  port,
  password,
  connectTimeout: 2500,
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  retryStrategy: () => null, // don't loop on failure
});

async function runCheck() {
  try {
    await redis.connect();
    const pong = await redis.ping();

    console.log(`✅ Redis Status: ACTIVE & HEALTHY`);
    console.log(`   PING Response: "${pong}"\n`);

    const streams = [
      'notif:stream:push',
      'notif:stream:whatsapp',
      'notif:stream:email',
      'notif:stream:dlq',
    ];

    console.log('--- Streams & Queue Depths ---');
    for (const s of streams) {
      try {
        const len = await redis.xlen(s);
        console.log(`  📊 Stream [${s}]: ${len} message(s)`);

        try {
          const groups = (await redis.xinfo('GROUPS', s)) as any[];
          if (groups && groups.length > 0) {
            for (const g of groups) {
              const gName = g[1];
              const gConsumers = g[3];
              const gPending = g[5];
              console.log(`     └─ Group "${gName}": ${gConsumers} consumer(s), ${gPending} pending`);
            }
          }
        } catch {
          // No groups yet
        }
      } catch (streamErr) {
        console.log(`  📊 Stream [${s}]: Not initialized yet (will auto-create on first event)`);
      }
    }

    console.log('\n====================================================');
    console.log('🎉 Redis is ready for asynchronous notification queues!');
    console.log('To run the background consumer daemon:');
    console.log('  npm run worker');
    console.log('====================================================\n');
  } catch (err: any) {
    console.error(`❌ Could not connect to Redis at ${host}:${port}`);
    console.error(`   Error details: ${err.message}\n`);
    console.log('--- Quick Fix: How to Start Redis ---');
    console.log('Option 1 (Recommended with Docker):');
    console.log('  npm run redis:up');
    console.log('\nOption 2 (Local Redis Service on Linux/WSL):');
    console.log('  sudo service redis-server start');
    console.log('\nOption 3 (Windows native / Memurai / Redis-server.exe):');
    console.log('  redis-server.exe\n');
  } finally {
    try {
      await redis.quit();
    } catch (_) {}
    process.exit(0);
  }
}

runCheck();
