import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildWorkbook, EXPORT_COLUMNS, type ExportRow } from "@/lib/domain/export";

const row: ExportRow = { num: 1, surfaceNumber: "776262", ownerNumber: "30.8", owner: "ЭЛВИС", type: "Билборд 3х6", format: "3х6", district: "Невский", address: "Ленина пр-т., д.10", side: "А", light: "есть", grp: "3.2", ots: "45000", period: "июль 2026" };

describe("buildWorkbook", () => {
  it("includes only selected columns in order", async () => {
    const buf = await buildWorkbook([row], ["num","address","owner"]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const ws = wb.worksheets[0];
    // ExcelJS row.values is 1-indexed with an empty slot at index 0.
    expect((ws.getRow(1).values as unknown[]).slice(1)).toEqual(["№", "Адрес", "Владелец"]);
    expect(ws.getRow(2).getCell(2).value).toBe("Ленина пр-т., д.10");
  });
  it("EXPORT_COLUMNS covers every ExportRow key", () => {
    const keys = Object.keys(row) as (keyof ExportRow)[];
    expect(EXPORT_COLUMNS.map((c) => c.key).sort()).toEqual(keys.sort());
  });
});
