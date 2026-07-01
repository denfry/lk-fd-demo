"use client";
import type { SurfaceListDTO } from "./SurfaceList";

export function WorkingListsPanel(_: { reloadKey: number; onChanged: () => void; onLoadToMap: (items: SurfaceListDTO[]) => void }) {
  return <div className="p-2 text-sm text-slate-500">Рабочие списки (заглушка)</div>;
}
