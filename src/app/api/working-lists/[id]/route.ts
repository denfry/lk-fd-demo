import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/session";
import { aggregateStatus, type MonthAvailability } from "@/lib/domain/availability";
import { periodKey } from "@/lib/serialize";

async function owned(id: string, clientId: string) {
  return prisma.workingList.findFirst({ where: { id, clientId } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(); if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const list = await prisma.workingList.findFirst({
    where: { id, clientId },
    include: { items: { include: { surface: { include: { construction: { include: { owner: true } }, availability: true } } } } },
  });
  if (!list) return NextResponse.json({ error: "not found" }, { status: 404 });
  const items = list.items.map((it) => {
    const s = it.surface;
    const months: MonthAvailability[] = s.availability.map((a) => ({ period: periodKey(a.period), status: a.status, priceNet: a.priceNet, priceGross: a.priceGross }));
    return { id: s.id, lat: s.construction.lat, lng: s.construction.lng, address: s.construction.address, district: s.construction.district, format: s.construction.format, type: s.construction.type, ownerName: s.construction.owner.name, sideCode: s.sideCode, status: aggregateStatus(months, []) };
  });
  return NextResponse.json({ id: list.id, name: list.name, items });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(); if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await owned(id, clientId))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = z.object({ name: z.string().min(1).max(100) }).parse(await req.json());
  await prisma.workingList.update({ where: { id }, data: { name: body.name } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(); if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await owned(id, clientId))) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.workingList.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
