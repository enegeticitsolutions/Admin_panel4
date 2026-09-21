import app from './main';
import { config } from './core/config';
import prisma from './core/database';
import { startMedicationWorker } from './workers/medicationWorker';
import { startCelebrationWorker } from './workers/celebrationWorker';

const start = async () => {
  try {
    await prisma.$connect();
    console.log('✅  Database connected');

    // Start background workers (guarded to prevent duplicate executions in cluster / multi-instance setups)
    const isPrimaryWorkerInstance = 
      process.env.RUN_BACKGROUND_WORKERS === 'true' ||
      (process.env.RUN_BACKGROUND_WORKERS !== 'false' && 
       (process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === '0'));

    if (isPrimaryWorkerInstance) {
      startMedicationWorker();
      startCelebrationWorker();
    } else {
      console.log(`ℹ️  [Workers] Background workers skipped on worker replica (instance ${process.env.NODE_APP_INSTANCE})`);
    }

    app.listen(Number(config.port), '0.0.0.0', () => {
      console.log(`🚀  Server running on http://0.0.0.0:${config.port}/api`);
      console.log(`📦  Environment: ${config.nodeEnv}`);
    });
  } catch (err) {
    console.error('❌  Failed to start server:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
};

start();