import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/api-guard";

const Patch = z.object({
  name: z.string().min(1).max(200).optional(),
  site: z.string().max(300).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  contactPerson: z.string().max(200).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await prisma.owner.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  const count = await prisma.construction.count({ where: { ownerId: id } });
  if (count > 0) return NextResponse.json({ error: "owner has constructions" }, { status: 409 });
  await prisma.owner.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
