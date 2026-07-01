import type { AvailabilityStatus } from "@/lib/domain/availability";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  status: AvailabilityStatus;
  label: string;
}

export interface MapViewProps {
  markers: MapMarker[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function getMapProvider(): "yandex" | "leaflet" {
  return process.env.NEXT_PUBLIC_YANDEX_API_KEY ? "yandex" : "leaflet";
}
