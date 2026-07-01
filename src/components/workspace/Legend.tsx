"use client";
import { STATUS_COLORS, STATUS_LABELS, type AvailabilityStatus } from "@/lib/domain/availability";
export function Legend() {
  const items = Object.keys(STATUS_LABELS) as AvailabilityStatus[];
  return (
    <div className="flex flex-wrap gap-3 border-b bg-white px-2 py-1 text-xs text-slate-600">
      {items.map((s) => <span key={s} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[s] }} />{STATUS_LABELS[s]}</span>)}
    </div>
  );
}
