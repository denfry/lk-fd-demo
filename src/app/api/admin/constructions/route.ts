import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/api-guard";

const SideInput = z.object({
  sideCode: z.string().min(1).max(20),
  direction: z.string().max(50).optional().nullable(),
  surfaceNumber: z.string().max(50).optional().nullable(),
  gid: z.string().max(50).optional().nullable(),
  grp: z.number().optional().nullable(),
  ots: z.number().optional().nullable(),
});
const Input = z.object({
  ownerId: z.string(),
  constructionNumber: z.string().min(1).max(50),
  ownerNumber: z.string().max(50).optional().nullable(),
  type: z.string().min(1).max(100),
  format: z.string().min(1).max(50),
  district: z.string().min(1).max(100),
  address: z.string().min(1).max(500),
  lat: z.number(), lng: z.number(),
  lighting: z.boolean().default(false),
  sides: z.array(SideInput).default([]),
});

export async function GET(req: NextRequest) {
  const deny = await assertAdmin(); if (deny) return deny;
  const sp = req.nextUrl.searchParams;
  const owner = sp.get("owner");
  const q = sp.get("q")?.trim();
  const skip = Number(sp.get("skip") ?? 0);
  const take = Math.min(Number(sp.get("take") ?? 25), 100);
  const where: Record<string, unknown> = {};
  if (owner) where.ownerId = owner;
  if (q) where.OR = [{ address: { contains: q, mode: "insensitive" } }, { constructionNumber: { contains: q } }];
  const [total, rows] = await Promise.all([
    prisma.construction.count({ where }),
    prisma.construction.findMany({ where, skip, take, orderBy: { constructionNumber: "asc" }, include: { owner: true, _count: { select: { surfaces: true } } } }),
  ]);
  return NextResponse.json({ total, items: rows.map((c) => ({ id: c.id, constructionNumber: c.constructionNumber, ownerName: c.owner.name, type: c.type, format: c.format, district: c.district, address: c.address, surfaceCount: c._count.surfaces })) });
}

export async function POST(req: NextRequest) {
  const deny = await assertAdmin(); if (deny) return deny;
  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request", detail: parsed.error.flatten() }, { status: 400 });
  const { sides, ...c } = parsed.data;
  const created = await prisma.construction.create({
    data: { ...c, surfaces: { create: sides.map((s) => ({ ...s })) } },
  });
  return NextResponse.json({ id: created.id });
}
