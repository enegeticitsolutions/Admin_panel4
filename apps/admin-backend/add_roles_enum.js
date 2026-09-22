require('dotenv').config();
const { prisma } = require('./lib/prisma');

async function main() {
  console.log('Adding customer_service_manager to UserRole enum in DB...');
  await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'customer_service_manager';`);
  
  console.log('Adding saathi_coordinator to UserRole enum in DB...');
  await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'saathi_coordinator';`);
  
  console.log('Testing query with new roles...');
  const users = await prisma.user.findMany({
    where: {
      role: {
        in: ['admin', 'customer_service_manager', 'saathi_coordinator']
      }
    },
    take: 1
  });
  console.log('SUCCESS! Query executed without errors. Found users:', users.length);
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
