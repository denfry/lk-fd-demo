import { describe, it, expect } from "vitest";
import { parseFeedRecords } from "@/lib/domain/feed";

const base = {
  ownerName: "РИМ", constructionNumber: "500001", ownerNumber: "12.3", type: "Билборд 3х6", format: "3х6",
  district: "Невский", address: "Ленина пр-т., д.5", lat: "59.93", lng: "30.34", lighting: "да",
  sideCode: "А", direction: "прямое", surfaceNumber: "900001", gid: "500001А", grp: "5.2", ots: "42000",
  period: "2026-07", status: "FREE", priceNet: "120000",
};

describe("parseFeedRecords", () => {
  it("parses a valid record with correct types", () => {
    const { rows, errors } = parseFeedRecords([base]);
    expect(errors).toHaveLength(0);
    expect(rows[0]).toMatchObject({ ownerName: "РИМ", lat: 59.93, lng: 30.34, lighting: true, grp: 5.2, ots: 42000, period: "2026-07", status: "FREE", priceNet: 120000 });
  });
  it("collects errors for missing required fields", () => {
    const { rows, errors } = parseFeedRecords([{ ...base, address: "" }]);
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/address/i);
  });
  it("rejects a bad status and bad period", () => {
    expect(parseFeedRecords([{ ...base, status: "NOPE" }]).errors[0].message).toMatch(/status/i);
    expect(parseFeedRecords([{ ...base, period: "2026/07" }]).errors[0].message).toMatch(/period/i);
  });
  it("maps empty numeric fields to null", () => {
    const { rows } = parseFeedRecords([{ ...base, grp: "", ots: "", priceNet: "" }]);
    expect(rows[0].grp).toBeNull();
    expect(rows[0].ots).toBeNull();
    expect(rows[0].priceNet).toBeNull();
  });
});
