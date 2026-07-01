import ExcelJS from "exceljs";

export interface ExportRow {
  num: number;
  surfaceNumber: string;
  ownerNumber: string;
  owner: string;
  type: string;
  format: string;
  district: string;
  address: string;
  side: string;
  light: string;
  grp: string;
  ots: string;
  period: string;
}

export const EXPORT_COLUMNS: { key: keyof ExportRow; header: string }[] = [
  { key: "num", header: "№" },
  { key: "surfaceNumber", header: "№ Пов-ти" },
  { key: "ownerNumber", header: "№ Влад-ца" },
  { key: "owner", header: "Владелец" },
  { key: "type", header: "Тип" },
  { key: "format", header: "Формат" },
  { key: "district", header: "Район" },
  { key: "address", header: "Адрес" },
  { key: "side", header: "Сторона" },
  { key: "light", header: "Свет" },
  { key: "grp", header: "GRP" },
  { key: "ots", header: "OTS" },
  { key: "period", header: "Период" },
];

export async function buildWorkbook(rows: ExportRow[], columnKeys: (keyof ExportRow)[]): Promise<Buffer> {
  // Preserve the caller's column order (not EXPORT_COLUMNS order), dropping unknown keys.
  const byKey = new Map(EXPORT_COLUMNS.map((c) => [c.key, c] as const));
  const cols = columnKeys.map((k) => byKey.get(k)).filter((c): c is (typeof EXPORT_COLUMNS)[number] => Boolean(c));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Рабочий список");
  ws.addRow(cols.map((c) => c.header));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(cols.map((c) => r[c.key]));
  cols.forEach((_, i) => { ws.getColumn(i + 1).width = 18; });
  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}
