"use client";
import dynamic from "next/dynamic";
import type { MapViewProps } from "./provider";

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });

export function MapView(props: MapViewProps) {
  return <LeafletMap {...props} />;
}
