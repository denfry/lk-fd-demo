import { describe, it, expect } from "vitest";
import { aggregateStatus, type MonthAvailability } from "@/lib/domain/availability";

const m = (period: string, status: MonthAvailability["status"]): MonthAvailability =>
  ({ period, status, priceNet: null, priceGross: null });

describe("aggregateStatus", () => {
  it("returns FREE if any selected month is free", () => {
    const months = [m("2026-01", "SOLD"), m("2026-02", "FREE")];
    expect(aggregateStatus(months, ["2026-01", "2026-02"])).toBe("FREE");
  });
  it("returns SOLD if all selected months are sold", () => {
    const months = [m("2026-01", "SOLD"), m("2026-02", "SOLD")];
    expect(aggregateStatus(months, ["2026-01", "2026-02"])).toBe("SOLD");
  });
  it("respects selected periods only", () => {
    const months = [m("2026-01", "FREE"), m("2026-02", "SOLD")];
    expect(aggregateStatus(months, ["2026-02"])).toBe("SOLD");
  });
  it("uses all months when selection empty", () => {
    const months = [m("2026-01", "SOLD"), m("2026-02", "FREE")];
    expect(aggregateStatus(months, [])).toBe("FREE");
  });
  it("returns NEEDS_CHECK over RESERVED_OTHER when no free/sold-all", () => {
    const months = [m("2026-01", "RESERVED_OTHER"), m("2026-02", "NEEDS_CHECK")];
    expect(aggregateStatus(months, [])).toBe("NEEDS_CHECK");
  });
  it("falls through to RESERVED_OTHER when only reserved/sold mix remains", () => {
    const months = [m("2026-01", "RESERVED_OTHER"), m("2026-02", "SOLD")];
    expect(aggregateStatus(months, [])).toBe("RESERVED_OTHER");
  });
  it("returns NEEDS_CHECK when scope is empty (selected periods have no data)", () => {
    const months = [m("2026-01", "FREE")];
    expect(aggregateStatus(months, ["2026-12"])).toBe("NEEDS_CHECK");
  });
});
