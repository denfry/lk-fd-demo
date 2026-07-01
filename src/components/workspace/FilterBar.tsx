"use client";
import { useEffect, useState } from "react";
import { STATUS_LABELS, type AvailabilityStatus } from "@/lib/domain/availability";

export interface Facets { owners: { id: string; name: string }[]; districts: string[]; formats: string[]; types: string[]; sides: string[]; periods: string[] }
export interface ActiveFilters { ownerIds: string[]; districts: string[]; formats: string[]; types: string[]; sides: string[]; periods: string[]; statuses: AvailabilityStatus[]; q: string }

function Multi({ label, options, values, onChange }: { label: string; options: { value: string; label: string }[]; values: string[]; onChange: (v: string[]) => void }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md border px-2 py-1 text-sm">
        {label}{values.length ? ` (${values.length})` : ""}
      </summary>
      <div className="absolute z-[1000] mt-1 max-h-64 w-56 overflow-auto rounded-md border bg-white p-2 shadow">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 py-0.5 text-sm">
            <input type="checkbox" checked={values.includes(o.value)}
              onChange={(e) => onChange(e.target.checked ? [...values, o.value] : values.filter((x) => x !== o.value))} />
            {o.label}
          </label>
        ))}
      </div>
    </details>
  );
}

export function FilterBar({ facets, filters, onChange, tab, onTab, count }: { facets: Facets; filters: ActiveFilters; onChange: (f: ActiveFilters) => void; tab: "map" | "list"; onTab: (t: "map" | "list") => void; count: number }) {
  const [q, setQ] = useState(filters.q);
  useEffect(() => { const t = setTimeout(() => onChange({ ...filters, q }), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q]);
  const patch = (p: Partial<ActiveFilters>) => onChange({ ...filters, ...p });
  const statusOpts = (Object.keys(STATUS_LABELS) as AvailabilityStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }));

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-white p-2">
      <Multi label="Владелец" options={facets.owners.map((o) => ({ value: o.id, label: o.name }))} values={filters.ownerIds} onChange={(v) => patch({ ownerIds: v })} />
      <Multi label="Район" options={facets.districts.map((d) => ({ value: d, label: d }))} values={filters.districts} onChange={(v) => patch({ districts: v })} />
      <Multi label="Формат" options={facets.formats.map((f) => ({ value: f, label: f }))} values={filters.formats} onChange={(v) => patch({ formats: v })} />
      <Multi label="Тип" options={facets.types.map((t) => ({ value: t, label: t }))} values={filters.types} onChange={(v) => patch({ types: v })} />
      <Multi label="Сторона" options={facets.sides.map((s) => ({ value: s, label: s }))} values={filters.sides} onChange={(v) => patch({ sides: v })} />
      <Multi label="Период" options={facets.periods.map((p) => ({ value: p, label: p }))} values={filters.periods} onChange={(v) => patch({ periods: v })} />
      <Multi label="Свободность" options={statusOpts} values={filters.statuses} onChange={(v) => patch({ statuses: v as AvailabilityStatus[] })} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по адресу/номеру" className="rounded-md border px-2 py-1 text-sm" />
      <div className="ml-auto flex items-center gap-2">
        <span className="text-sm text-slate-500">Найдено: {count}</span>
        <div className="flex overflow-hidden rounded-md border text-sm">
          <button onClick={() => onTab("map")} className={`px-3 py-1 ${tab === "map" ? "bg-slate-900 text-white" : ""}`}>Карта</button>
          <button onClick={() => onTab("list")} className={`px-3 py-1 ${tab === "list" ? "bg-slate-900 text-white" : ""}`}>Список</button>
        </div>
      </div>
    </div>
  );
}
