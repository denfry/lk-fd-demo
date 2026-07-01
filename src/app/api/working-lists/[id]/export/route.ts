import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/session";
import { buildWorkbook, EXPORT_COLUMNS, type ExportRow } from "@/lib/domain/export";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(); if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const list = await prisma.workingList.findFirst({
    where: { id, clientId },
    include: { items: { include: { surface: { include: { construction: { include: { owner: true } } } } } } },
  });
  if (!list) return NextResponse.json({ error: "not found" }, { status: 404 });

  const requested = req.nextUrl.searchParams.get("cols");
  const cols = (requested ? requested.split(",") : EXPORT_COLUMNS.map((c) => c.key)) as (keyof ExportRow)[];

  const rows: ExportRow[] = list.items.map((it, i) => {
    const s = it.surface, c = s.construction;
    return { num: i + 1, surfaceNumber: s.surfaceNumber ?? "", ownerNumber: c.ownerNumber ?? "", owner: c.owner.name, type: c.type, format: c.format, district: c.district, address: c.address, side: s.sideCode, light: c.lighting ? "есть" : "нет", grp: s.grp?.toString() ?? "", ots: s.ots?.toString() ?? "", period: "2026" };
  });
  const buf = await buildWorkbook(rows, cols);
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="working-list-${id}.xlsx"`,
    },
  });
}
