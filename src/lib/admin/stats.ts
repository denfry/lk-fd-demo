import { prisma } from "@/lib/db";

export async function loadAdminStats() {
  const [owners, clients, constructions, surfaces, total, free] = await Promise.all([
    prisma.owner.count(),
    prisma.client.count(),
    prisma.construction.count(),
    prisma.surface.count(),
    prisma.availability.count(),
    prisma.availability.count({ where: { status: "FREE" } }),
  ]);
  const occupancyPct = total === 0 ? 0 : Math.round(((total - free) / total) * 100);
  return { owners, clients, constructions, surfaces, occupancyPct };
}
