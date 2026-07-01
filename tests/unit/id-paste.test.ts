import { describe, it, expect } from "vitest";
import { parsePastedIds } from "@/lib/domain/id-paste";

describe("parsePastedIds", () => {
  it("splits on spaces, commas, newlines, semicolons", () => {
    expect(parsePastedIds("629094 992123,961000\n166299;123")).toEqual(["629094","992123","961000","166299","123"]);
  });
  it("dedupes preserving order", () => {
    expect(parsePastedIds("10 10 20 10")).toEqual(["10","20"]);
  });
  it("caps to limit", () => {
    const raw = Array.from({length: 600}, (_,i)=>String(i)).join(" ");
    expect(parsePastedIds(raw).length).toBe(500);
  });
  it("returns empty for blank", () => {
    expect(parsePastedIds("   \n ")).toEqual([]);
  });
});
