import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function globalTeardown(): Promise<void> {
  await prisma.$disconnect();
}
