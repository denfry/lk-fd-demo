import { prisma } from "@/lib/db";

export async function loadFacets() {
  const [owners, constructions] = await Promise.all([
    prisma.owner.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.construction.findMany({ select: { district: true, format: true, type: true } }),
  ]);
  const uniq = (xs: string[]) => Array.from(new Set(xs)).sort();
  const periods = Array.from({ length: 12 }, (_, m) => `2026-${String(m + 1).padStart(2, "0")}`);
  return {
    owners,
    districts: uniq(constructions.map((c) => c.district)),
    formats: uniq(constructions.map((c) => c.format)),
    types: uniq(constructions.map((c) => c.type)),
    sides: ["А", "Б"],
    periods,
  };
}
