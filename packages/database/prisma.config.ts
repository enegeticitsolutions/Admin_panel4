import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../apps/api/.env') });
dotenv.config();

export default defineConfig({
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
});
