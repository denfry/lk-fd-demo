"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { STATUS_COLORS } from "@/lib/domain/availability";
import type { MapViewProps } from "./provider";

const SPB: [number, number] = [59.94, 30.35];

function dotIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 2px rgba(0,0,0,.5)"></span>`,
    iconSize: [14, 14],
  });
}

export default function LeafletMap({ markers, onSelect }: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<any>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current).setView(SPB, 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);
    clusterRef.current = (L as any).markerClusterGroup();
    map.addLayer(clusterRef.current);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; clusterRef.current = null; };
  }, []);

  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();
    for (const m of markers) {
      const marker = L.marker([m.lat, m.lng], { icon: dotIcon(STATUS_COLORS[m.status]) });
      marker.bindTooltip(m.label);
      marker.on("click", () => onSelect(m.id));
      cluster.addLayer(marker);
    }
  }, [markers, onSelect]);

  return <div ref={ref} className="h-full w-full" />;
}
