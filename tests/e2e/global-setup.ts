import { PrismaClient } from "@prisma/client";

// Reset working lists before the e2e run so the suite starts from a clean,
// repeatable state (prior runs would otherwise accumulate lists).
export default async function globalSetup() {
  const prisma = new PrismaClient();
  await prisma.workingListItem.deleteMany();
  await prisma.workingList.deleteMany();
  await prisma.$disconnect();
}
