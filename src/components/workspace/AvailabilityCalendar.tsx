"use client";
import { STATUS_COLORS, STATUS_LABELS, type MonthAvailability } from "@/lib/domain/availability";

const RU = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
function monthLabel(period: string) { const m = Number(period.split("-")[1]); return RU[m - 1]; }

export function AvailabilityCalendar({ months }: { months: MonthAvailability[] }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {months.map((m) => (
        <div key={m.period} className="rounded-md border p-1 text-center text-xs" title={STATUS_LABELS[m.status]}>
          <div className="font-medium">{monthLabel(m.period)}</div>
          <div className="my-1 h-1.5 rounded-full" style={{ background: STATUS_COLORS[m.status] }} />
          <div className="text-[10px] text-slate-500">{m.priceNet ? m.priceNet.toLocaleString("ru-RU") : "—"}</div>
        </div>
      ))}
    </div>
  );
}
