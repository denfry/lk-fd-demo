import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/session";
import { periodKey } from "@/lib/serialize";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId();
  if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const s = await prisma.surface.findUnique({
    where: { id },
    include: { construction: { include: { owner: true } }, availability: { orderBy: { period: "asc" } } },
  });
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    id: s.id, sideCode: s.sideCode, direction: s.direction, gid: s.gid, surfaceNumber: s.surfaceNumber,
    grp: s.grp, ots: s.ots, oneShowSec: s.oneShowSec, showsPerDay: s.showsPerDay,
    construction: {
      constructionNumber: s.construction.constructionNumber, ownerNumber: s.construction.ownerNumber,
      ownerName: s.construction.owner.name, ownerSite: s.construction.owner.site,
      type: s.construction.type, format: s.construction.format, district: s.construction.district,
      address: s.construction.address, lat: s.construction.lat, lng: s.construction.lng,
      lighting: s.construction.lighting, description: s.construction.description, panoramaUrl: s.construction.panoramaUrl,
    },
    months: s.availability.map((a) => ({ period: periodKey(a.period), status: a.status, priceNet: a.priceNet, priceGross: a.priceGross })),
  });
}
