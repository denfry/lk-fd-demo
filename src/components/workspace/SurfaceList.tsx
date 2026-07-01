"use client";
import type { AvailabilityStatus } from "@/lib/domain/availability";

export interface SurfaceListDTO { id: string; lat: number; lng: number; address: string; district: string; format: string; type: string; ownerName: string; sideCode: string; status: AvailabilityStatus }

export function SurfaceList({ surfaces }: { surfaces: SurfaceListDTO[]; onSelect: (id: string) => void }) {
  return <div className="p-2 text-sm text-slate-500">Список (заглушка): {surfaces.length}</div>;
}
