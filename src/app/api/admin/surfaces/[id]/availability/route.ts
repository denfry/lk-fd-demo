import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/api-guard";
import { periodKey } from "@/lib/serialize";

const Month = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  status: z.enum(["FREE", "SOLD", "RESERVED_OTHER", "NEEDS_CHECK"]),
  priceNet: z.number().int().optional().nullable(),
  priceGross: z.number().int().optional().nullable(),
});
const Body = z.object({ months: z.array(Month) });

function toDate(p: string) { const [y, m] = p.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)); }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  const rows = await prisma.availability.findMany({ where: { surfaceId: id }, orderBy: { period: "asc" } });
  return NextResponse.json({ months: rows.map((a) => ({ period: periodKey(a.period), status: a.status, priceNet: a.priceNet, priceGross: a.priceGross })) });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await prisma.$transaction(parsed.data.months.map((m) =>
    prisma.availability.upsert({
      where: { surfaceId_period: { surfaceId: id, period: toDate(m.period) } },
      create: { surfaceId: id, period: toDate(m.period), status: m.status, priceNet: m.priceNet ?? null, priceGross: m.priceGross ?? null },
      update: { status: m.status, priceNet: m.priceNet ?? null, priceGross: m.priceGross ?? null },
    })
  ));
  return NextResponse.json({ ok: true });
}
