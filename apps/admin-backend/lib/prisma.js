const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

/**
 * Prisma Client & Pool Singleton
 *
 * Uses Supabase's transaction-mode pooler (the only option on free tier).
 * Transaction-mode pooler does NOT support persistent connections or keepAlive.
 * We use a small pool with short idle timeout to avoid stale connections.
 */

const globalForPrisma = global;

const isLocal = !process.env.DATABASE_URL || 
  process.env.DATABASE_URL.includes('localhost') || 
  process.env.DATABASE_URL.includes('127.0.0.1');

const pool =
  globalForPrisma.pool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: parseInt(process.env.DB_POOL_MAX || '5', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || '10000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONN_TIMEOUT_MS || '15000', 10),
  });

pool.on('error', (err) => {
  console.error('[prisma.js] Pool client error:', err.message);
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.pool = pool;
}

const adapter = new PrismaPg(pool);

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = { prisma, pool };
