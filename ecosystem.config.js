module.exports = {
  apps: [
    {
      name: 'maihoonna-api',
      cwd: './apps/api',
      script: 'dist/app/run.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8001,
      },
    },
    {
      name: 'maihoonna-admin-backend',
      cwd: './apps/admin-backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
    {
      name: 'maihoonna-notification-worker',
      cwd: './packages/notifications',
      script: 'dist/service/worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
