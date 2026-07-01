import type { AvailabilityStatus } from "./availability";

export interface SurfaceFilters {
  ownerIds: string[];
  districts: string[];
  formats: string[];
  types: string[];
  sides: string[];
  periods: string[]; // "YYYY-MM"
  statuses: AvailabilityStatus[];
  q: string | null;
}

const VALID_STATUS = new Set(["FREE","SOLD","RESERVED_OTHER","NEEDS_CHECK"]);
const PERIOD_RE = /^\d{4}-\d{2}$/;

export function parseFilters(sp: URLSearchParams): SurfaceFilters {
  const all = (k: string) => sp.getAll(k).filter(Boolean);
  return {
    ownerIds: all("owner"),
    districts: all("district"),
    formats: all("format"),
    types: all("type"),
    sides: all("side"),
    periods: all("period").filter((p) => PERIOD_RE.test(p)),
    statuses: all("status").filter((s) => VALID_STATUS.has(s)) as AvailabilityStatus[],
    q: sp.get("q")?.trim() || null,
  };
}

function periodToDate(p: string): Date {
  const [y, m] = p.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export function buildSurfaceWhere(f: SurfaceFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  const construction: Record<string, unknown> = {};
  if (f.ownerIds.length) construction.ownerId = { in: f.ownerIds };
  if (f.districts.length) construction.district = { in: f.districts };
  if (f.formats.length) construction.format = { in: f.formats };
  if (f.types.length) construction.type = { in: f.types };
  if (Object.keys(construction).length) where.construction = construction;

  if (f.sides.length) where.sideCode = { in: f.sides };

  const avail: Record<string, unknown> = {};
  if (f.periods.length) avail.period = { in: f.periods.map(periodToDate) };
  if (f.statuses.length) avail.status = { in: f.statuses };
  if (Object.keys(avail).length) where.availability = { some: avail };

  if (f.q) {
    where.OR = [
      { construction: { address: { contains: f.q, mode: "insensitive" } } },
      { construction: { constructionNumber: { contains: f.q } } },
      { surfaceNumber: { contains: f.q } },
      { gid: { contains: f.q } },
    ];
  }
  return where;
}
