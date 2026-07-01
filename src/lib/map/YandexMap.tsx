"use client";
import { useEffect, useRef } from "react";
import { STATUS_COLORS } from "@/lib/domain/availability";
import type { MapViewProps } from "./provider";

declare global { interface Window { ymaps3?: any } }

async function loadYmaps(apiKey: string) {
  if (window.ymaps3) return window.ymaps3;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/v3/?apikey=${apiKey}&lang=ru_RU`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("ymaps load failed"));
    document.head.appendChild(s);
  });
  await window.ymaps3.ready;
  return window.ymaps3;
}

export default function YandexMap({ markers, onSelect }: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const apiKey = process.env.NEXT_PUBLIC_YANDEX_API_KEY as string;

  useEffect(() => {
    let map: any;
    let cancelled = false;
    (async () => {
      const ymaps3 = await loadYmaps(apiKey);
      if (cancelled || !ref.current) return;
      const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = ymaps3;
      map = new YMap(ref.current, { location: { center: [30.35, 59.94], zoom: 11 } });
      map.addChild(new YMapDefaultSchemeLayer());
      map.addChild(new YMapDefaultFeaturesLayer());
      for (const m of markers) {
        const el = document.createElement("div");
        el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${STATUS_COLORS[m.status]};border:2px solid #fff;cursor:pointer`;
        el.title = m.label;
        el.onclick = () => onSelect(m.id);
        map.addChild(new YMapMarker({ coordinates: [m.lng, m.lat] }, el));
      }
    })();
    return () => { cancelled = true; if (map) map.destroy(); };
  }, [markers, onSelect, apiKey]);

  return <div ref={ref} className="h-full w-full" />;
}
