"use client";
import type { AvailabilityStatus } from "@/lib/domain/availability";

export interface Facets { owners: { id: string; name: string }[]; districts: string[]; formats: string[]; types: string[]; sides: string[]; periods: string[] }
export interface ActiveFilters { ownerIds: string[]; districts: string[]; formats: string[]; types: string[]; sides: string[]; periods: string[]; statuses: AvailabilityStatus[]; q: string }

export function FilterBar(_: { facets: Facets; filters: ActiveFilters; onChange: (f: ActiveFilters) => void; tab: "map" | "list"; onTab: (t: "map" | "list") => void; count: number }) {
  return <div className="border-b p-2 text-sm text-slate-500">Фильтры (заглушка)</div>;
}
