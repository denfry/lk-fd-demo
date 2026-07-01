import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/session";

export async function GET() {
  const clientId = await getClientId();
  if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const lists = await prisma.workingList.findMany({
    where: { clientId }, orderBy: { createdAt: "asc" }, include: { _count: { select: { items: true } } },
  });
  return NextResponse.json({ lists: lists.map((l) => ({ id: l.id, name: l.name, count: l._count.items })) });
}

export async function POST(req: NextRequest) {
  const clientId = await getClientId();
  if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = z.object({ name: z.string().min(1).max(100) }).parse(await req.json());
  const list = await prisma.workingList.create({ data: { clientId, name: body.name } });
  return NextResponse.json({ id: list.id });
}
