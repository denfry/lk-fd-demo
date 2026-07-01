"use client";
import { useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { MapView } from "@/lib/map/MapView";
import type { MapMarker } from "@/lib/map/provider";
import { FilterBar, type Facets, type ActiveFilters } from "@/components/workspace/FilterBar";
import { SurfaceList, type SurfaceListDTO } from "@/components/workspace/SurfaceList";
import { SideCard } from "@/components/workspace/SideCard";
import { WorkingListsPanel } from "@/components/workspace/WorkingListsPanel";
import { Legend } from "@/components/workspace/Legend";

function toQuery(f: ActiveFilters): string {
  const sp = new URLSearchParams();
  f.ownerIds.forEach((v) => sp.append("owner", v));
  f.districts.forEach((v) => sp.append("district", v));
  f.formats.forEach((v) => sp.append("format", v));
  f.types.forEach((v) => sp.append("type", v));
  f.sides.forEach((v) => sp.append("side", v));
  f.periods.forEach((v) => sp.append("period", v));
  f.statuses.forEach((v) => sp.append("status", v));
  if (f.q) sp.set("q", f.q);
  return sp.toString();
}

const EMPTY: ActiveFilters = { ownerIds: [], districts: [], formats: [], types: [], sides: [], periods: [], statuses: [], q: "" };

export function WorkspaceClient({ facets }: { facets: Facets }) {
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY);
  const [surfaces, setSurfaces] = useState<SurfaceListDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"map" | "list">("map");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/surfaces?${toQuery(filters)}`, { signal: ctrl.signal })
      .then((r) => r.json()).then((d) => setSurfaces(d.surfaces ?? [])).catch(() => {});
    return () => ctrl.abort();
  }, [filters]);

  const markers: MapMarker[] = surfaces.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, status: s.status, label: `${s.address} (${s.sideCode})` }));
  const onListsChanged = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white px-4 py-2">
        <h1 className="font-semibold">Личный кабинет FD</h1>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-sm text-slate-500 hover:text-slate-800">Выйти</button>
      </header>
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={26} minSize={18}>
          <SideCard surfaceId={selectedId} />
        </Panel>
        <PanelResizeHandle className="w-1 bg-slate-200" />
        <Panel defaultSize={48} minSize={30}>
          <div className="flex h-full flex-col">
            <FilterBar facets={facets} filters={filters} onChange={setFilters} tab={tab} onTab={setTab} count={surfaces.length} />
            {tab === "map" && <Legend />}
            <div className="relative flex-1">
              {tab === "map"
                ? <MapView markers={markers} selectedId={selectedId} onSelect={setSelectedId} />
                : <SurfaceList surfaces={surfaces} onSelect={setSelectedId} />}
            </div>
          </div>
        </Panel>
        <PanelResizeHandle className="w-1 bg-slate-200" />
        <Panel defaultSize={26} minSize={18}>
          <WorkingListsPanel reloadKey={reloadKey} onChanged={onListsChanged} onLoadToMap={(items) => { setSurfaces(items); setTab("map"); }} />
        </Panel>
      </PanelGroup>
    </div>
  );
}
