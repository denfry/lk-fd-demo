import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/session";
import { parsePastedIds } from "@/lib/domain/id-paste";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(); if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const list = await prisma.workingList.findFirst({ where: { id, clientId } });
  if (!list) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = z.object({ ids: z.array(z.string()).optional(), raw: z.string().optional() }).parse(await req.json());
  const tokens = body.ids ?? parsePastedIds(body.raw ?? "");
  const surfaces = await prisma.surface.findMany({ where: { OR: [{ id: { in: tokens } }, { surfaceNumber: { in: tokens } }] }, select: { id: true } });
  if (surfaces.length === 0) return NextResponse.json({ added: 0 });
  const res = await prisma.workingListItem.createMany({
    data: surfaces.map((s) => ({ listId: id, surfaceId: s.id })), skipDuplicates: true,
  });
  return NextResponse.json({ added: res.count });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(); if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const list = await prisma.workingList.findFirst({ where: { id, clientId } });
  if (!list) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = z.object({ surfaceId: z.string() }).parse(await req.json());
  await prisma.workingListItem.deleteMany({ where: { listId: id, surfaceId: body.surfaceId } });
  return NextResponse.json({ ok: true });
}
