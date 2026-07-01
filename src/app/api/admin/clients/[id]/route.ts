import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/api-guard";

const Patch = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  contactPerson: z.string().max(200).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await prisma.client.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  const [lists, users] = await Promise.all([
    prisma.workingList.count({ where: { clientId: id } }),
    prisma.user.count({ where: { clientId: id } }),
  ]);
  if (lists > 0 || users > 0) return NextResponse.json({ error: "client has users or lists" }, { status: 409 });
  await prisma.client.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
