import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/api-guard";

const OwnerInput = z.object({
  name: z.string().min(1).max(200),
  site: z.string().max(300).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  contactPerson: z.string().max(200).optional().nullable(),
});

export async function GET() {
  const deny = await assertAdmin(); if (deny) return deny;
  const owners = await prisma.owner.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ owners });
}

export async function POST(req: NextRequest) {
  const deny = await assertAdmin(); if (deny) return deny;
  const parsed = OwnerInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const owner = await prisma.owner.create({ data: parsed.data });
  return NextResponse.json({ id: owner.id });
}
