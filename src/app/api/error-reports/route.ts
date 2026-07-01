import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const clientId = await getClientId(); if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = z.object({ surfaceId: z.string(), reasons: z.array(z.string()), comment: z.string().max(2000).optional() }).parse(await req.json());
  await prisma.errorReport.create({ data: { surfaceId: body.surfaceId, reasons: body.reasons, comment: body.comment } });
  return NextResponse.json({ ok: true });
}
