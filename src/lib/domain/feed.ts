import type { AvailabilityStatus } from "./availability";

export interface FeedRow {
  ownerName: string; constructionNumber: string; ownerNumber: string | null;
  type: string; format: string; district: string; address: string;
  lat: number; lng: number; lighting: boolean;
  sideCode: string; direction: string | null; surfaceNumber: string | null; gid: string | null;
  grp: number | null; ots: number | null;
  period: string; status: AvailabilityStatus; priceNet: number | null;
}
export interface FeedParseResult { rows: FeedRow[]; errors: { line: number; message: string }[] }

const STATUSES = new Set(["FREE", "SOLD", "RESERVED_OTHER", "NEEDS_CHECK"]);
const REQUIRED = ["ownerName", "constructionNumber", "type", "format", "district", "address", "lat", "lng", "sideCode", "period", "status"];

function num(v: string | undefined): number | null {
  const t = (v ?? "").trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}
function bool(v: string | undefined): boolean {
  return ["да", "1", "true", "yes", "есть"].includes((v ?? "").trim().toLowerCase());
}

export function parseFeedRecords(records: Record<string, string>[]): FeedParseResult {
  const rows: FeedRow[] = [];
  const errors: { line: number; message: string }[] = [];
  records.forEach((r, i) => {
    const line = i + 2; // 1-based + header
    const missing = REQUIRED.filter((k) => !(r[k] ?? "").trim());
    if (missing.length) { errors.push({ line, message: `missing required: ${missing.join(", ")}` }); return; }
    if (!/^\d{4}-\d{2}$/.test(r.period.trim())) { errors.push({ line, message: `bad period: ${r.period}` }); return; }
    if (!STATUSES.has(r.status.trim())) { errors.push({ line, message: `bad status: ${r.status}` }); return; }
    const lat = num(r.lat), lng = num(r.lng), grp = num(r.grp), ots = num(r.ots), priceNet = num(r.priceNet);
    if (lat === null || Number.isNaN(lat) || lng === null || Number.isNaN(lng)) { errors.push({ line, message: `bad lat/lng` }); return; }
    if ([grp, ots, priceNet].some((x) => Number.isNaN(x))) { errors.push({ line, message: `bad numeric field` }); return; }
    rows.push({
      ownerName: r.ownerName.trim(), constructionNumber: r.constructionNumber.trim(),
      ownerNumber: r.ownerNumber?.trim() || null, type: r.type.trim(), format: r.format.trim(),
      district: r.district.trim(), address: r.address.trim(), lat, lng, lighting: bool(r.lighting),
      sideCode: r.sideCode.trim(), direction: r.direction?.trim() || null,
      surfaceNumber: r.surfaceNumber?.trim() || null, gid: r.gid?.trim() || null,
      grp, ots, period: r.period.trim(), status: r.status.trim() as AvailabilityStatus, priceNet,
    });
  });
  return { rows, errors };
}
