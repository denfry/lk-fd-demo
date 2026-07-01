import { PrismaClient } from "@prisma/client";

// Reset per-run state so the e2e suite starts clean and repeatable (prior runs
// would otherwise accumulate working lists and E2E-created owners).
export default async function globalSetup() {
  const prisma = new PrismaClient();
  await prisma.workingListItem.deleteMany();
  await prisma.workingList.deleteMany();
  await prisma.user.deleteMany({ where: { email: { startsWith: "e2e" } } });
  await prisma.owner.deleteMany({ where: { name: { startsWith: "E2E" } } });
  await prisma.$disconnect();
}
