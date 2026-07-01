import { describe, it, expect } from "vitest";
import { parseFilters, buildSurfaceWhere } from "@/lib/domain/filters";

describe("parseFilters", () => {
  it("reads repeated and single params", () => {
    const sp = new URLSearchParams("owner=o1&owner=o2&district=Невский&status=FREE&period=2026-07&q=Ленина");
    const f = parseFilters(sp);
    expect(f.ownerIds).toEqual(["o1","o2"]);
    expect(f.districts).toEqual(["Невский"]);
    expect(f.statuses).toEqual(["FREE"]);
    expect(f.periods).toEqual(["2026-07"]);
    expect(f.q).toBe("Ленина");
  });
});

describe("buildSurfaceWhere", () => {
  it("maps owners/districts to construction relation", () => {
    const where: any = buildSurfaceWhere(parseFilters(new URLSearchParams("owner=o1&district=Невский")));
    expect(where.construction.ownerId.in).toEqual(["o1"]);
    expect(where.construction.district.in).toEqual(["Невский"]);
  });
  it("maps status+period to availability.some", () => {
    const where: any = buildSurfaceWhere(parseFilters(new URLSearchParams("status=FREE&period=2026-07")));
    expect(where.availability.some.status.in).toEqual(["FREE"]);
    expect(where.availability.some.period.in[0]).toBeInstanceOf(Date);
  });
  it("omits empty facets", () => {
    const where: any = buildSurfaceWhere(parseFilters(new URLSearchParams("")));
    expect(where.construction).toBeUndefined();
    expect(where.availability).toBeUndefined();
  });
});
