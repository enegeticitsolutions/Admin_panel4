import { defineConfig } from 'prisma/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Explicitly load .env from the current working directory and fallback to dirname
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(__dirname, '.env') });

export default defineConfig({
  schema: path.resolve(__dirname, '../../packages/database/prisma/schema.prisma'),

  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  },
});
