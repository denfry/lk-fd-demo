import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/api-guard";

const Input = z.object({
  name: z.string().min(1).max(200),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  contactPerson: z.string().max(200).optional().nullable(),
  // Login identifier, not necessarily a strict email — the demo convention uses
  // handles like client@demo / admin@demo (no TLD), and login treats it opaquely.
  user: z.object({ email: z.string().min(3).max(200), password: z.string().min(6), name: z.string().min(1) }).optional(),
});

export async function GET() {
  const deny = await assertAdmin(); if (deny) return deny;
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } });
  return NextResponse.json({ clients: clients.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, userCount: c._count.users })) });
}

export async function POST(req: NextRequest) {
  const deny = await assertAdmin(); if (deny) return deny;
  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { user, ...clientData } = parsed.data;
  const client = await prisma.client.create({ data: clientData });
  if (user) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await prisma.user.create({ data: { email: user.email, name: user.name, passwordHash, role: "CLIENT", clientId: client.id } });
  }
  return NextResponse.json({ id: client.id });
}
