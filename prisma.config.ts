import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Support .env in root, database package, admin-backend, and api
dotenv.config({ path: path.resolve(__dirname, 'packages/database/.env') });
dotenv.config({ path: path.resolve(__dirname, 'apps/admin-backend/.env') });
dotenv.config({ path: path.resolve(__dirname, 'apps/api/.env') });
dotenv.config();

export default defineConfig({
  schema: 'packages/database/prisma/schema.prisma',
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
});
