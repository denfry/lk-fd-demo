"use client";
import dynamic from "next/dynamic";
import { getMapProvider, type MapViewProps } from "./provider";

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });
const YandexMap = dynamic(() => import("./YandexMap"), { ssr: false });

export function MapView(props: MapViewProps) {
  return getMapProvider() === "yandex" ? <YandexMap {...props} /> : <LeafletMap {...props} />;
}
