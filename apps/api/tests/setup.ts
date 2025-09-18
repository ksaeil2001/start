import { execSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

const defaultDbUrl = 'postgresql://start:start@localhost:5432/start?schema=public';

export default async function globalSetup(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = defaultDbUrl;
  }

  const cwd = path.resolve(__dirname, '..');
  execSync('npx prisma migrate deploy', {
    cwd,
    env: { ...process.env },
    stdio: 'inherit'
  });

  execSync('npx prisma db seed', {
    cwd,
    env: { ...process.env },
    stdio: 'inherit'
  });
}
