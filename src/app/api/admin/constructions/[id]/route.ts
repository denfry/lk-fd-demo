import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/api-guard";

const Patch = z.object({
  ownerNumber: z.string().max(50).optional().nullable(),
  type: z.string().max(100).optional(),
  format: z.string().max(50).optional(),
  district: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  lat: z.number().optional(), lng: z.number().optional(),
  lighting: z.boolean().optional(),
  description: z.string().max(2000).optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  const c = await prisma.construction.findUnique({ where: { id }, include: { owner: true, surfaces: true } });
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(c);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await prisma.construction.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  await prisma.construction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
