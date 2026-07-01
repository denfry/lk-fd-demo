import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/api-guard";
import { parseFeedRecords } from "@/lib/domain/feed";

function periodToDate(p: string) { const [y, m] = p.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)); }

async function readRecords(file: File): Promise<Record<string, string>[]> {
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    const headers = (ws.getRow(1).values as unknown[]).slice(1).map((h) => String(h ?? "").trim());
    const out: Record<string, string>[] = [];
    ws.eachRow((row, idx) => {
      if (idx === 1) return;
      const rec: Record<string, string> = {};
      headers.forEach((h, i) => { rec[h] = String((row.values as unknown[])[i + 1] ?? "").trim(); });
      out.push(rec);
    });
    return out;
  }
  const text = await file.text();
  return Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true }).data;
}

export async function POST(req: NextRequest) {
  const deny = await assertAdmin(); if (deny) return deny;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });

  const { rows, errors } = parseFeedRecords(await readRecords(file));
  let created = 0, updated = 0;

  for (const r of rows) {
    const owner = await prisma.owner.upsert({ where: { name: r.ownerName }, create: { name: r.ownerName }, update: {} });
    const construction = await prisma.construction.upsert({
      where: { ownerId_constructionNumber: { ownerId: owner.id, constructionNumber: r.constructionNumber } },
      create: { ownerId: owner.id, constructionNumber: r.constructionNumber, ownerNumber: r.ownerNumber, type: r.type, format: r.format, district: r.district, address: r.address, lat: r.lat, lng: r.lng, lighting: r.lighting },
      update: { ownerNumber: r.ownerNumber, type: r.type, format: r.format, district: r.district, address: r.address, lat: r.lat, lng: r.lng, lighting: r.lighting },
    });
    const existing = await prisma.surface.findFirst({ where: { constructionId: construction.id, sideCode: r.sideCode }, select: { id: true } });
    let surfaceId: string;
    if (existing) {
      await prisma.surface.update({ where: { id: existing.id }, data: { direction: r.direction, surfaceNumber: r.surfaceNumber, gid: r.gid, grp: r.grp, ots: r.ots } });
      surfaceId = existing.id; updated++;
    } else {
      const s = await prisma.surface.create({ data: { constructionId: construction.id, sideCode: r.sideCode, direction: r.direction, surfaceNumber: r.surfaceNumber, gid: r.gid, grp: r.grp, ots: r.ots } });
      surfaceId = s.id; created++;
    }
    await prisma.availability.upsert({
      where: { surfaceId_period: { surfaceId, period: periodToDate(r.period) } },
      create: { surfaceId, period: periodToDate(r.period), status: r.status, priceNet: r.priceNet, priceGross: r.priceNet ? Math.round(r.priceNet * 1.22) : null },
      update: { status: r.status, priceNet: r.priceNet, priceGross: r.priceNet ? Math.round(r.priceNet * 1.22) : null },
    });
  }

  await prisma.feedImport.create({ data: { fileName: file.name, createdCount: created, updatedCount: updated } });
  return NextResponse.json({ created, updated, errors });
}
