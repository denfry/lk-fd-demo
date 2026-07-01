import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/session";
import { parseFilters, buildSurfaceWhere } from "@/lib/domain/filters";
import { aggregateStatus, type MonthAvailability } from "@/lib/domain/availability";
import { periodKey } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  const clientId = await getClientId();
  if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const filters = parseFilters(req.nextUrl.searchParams);
  const where = buildSurfaceWhere(filters);
  const rows = await prisma.surface.findMany({
    where,
    take: 500,
    orderBy: { id: "asc" },
    include: { construction: { include: { owner: true } }, availability: true },
  });
  const surfaces = rows.map((s) => {
    const months: MonthAvailability[] = s.availability.map((a) => ({
      period: periodKey(a.period), status: a.status, priceNet: a.priceNet, priceGross: a.priceGross,
    }));
    return {
      id: s.id, lat: s.construction.lat, lng: s.construction.lng,
      address: s.construction.address, district: s.construction.district,
      format: s.construction.format, type: s.construction.type,
      ownerName: s.construction.owner.name, sideCode: s.sideCode,
      status: aggregateStatus(months, filters.periods),
    };
  });
  return NextResponse.json({ surfaces });
}
