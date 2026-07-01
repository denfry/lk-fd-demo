"use client";
import { useEffect, useState } from "react";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import type { MonthAvailability } from "@/lib/domain/availability";

interface Detail {
  id: string; sideCode: string; direction: string | null; gid: string | null; surfaceNumber: string | null;
  grp: number | null; ots: number | null; oneShowSec: number | null; showsPerDay: number | null;
  construction: { constructionNumber: string; ownerNumber: string | null; ownerName: string; ownerSite: string | null; type: string; format: string; district: string; address: string; lat: number; lng: number; lighting: boolean; description: string | null; panoramaUrl: string | null };
  months: MonthAvailability[];
}

const REASONS = ["Затереть контакты владельца на фото", "Проверить положение на карте", "Проверить направление А и Б", "Другое"];

export function SideCard({ surfaceId }: { surfaceId: string | null }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!surfaceId) { setDetail(null); return; }
    setSent(false); setReasons([]); setComment("");
    fetch(`/api/surfaces/${surfaceId}`).then((r) => r.json()).then(setDetail).catch(() => setDetail(null));
  }, [surfaceId]);

  if (!surfaceId) return <div className="flex h-full items-center justify-center p-4 text-sm text-slate-400">Выберите поверхность на карте или в списке</div>;
  if (!detail) return <div className="p-4 text-sm text-slate-400">Загрузка…</div>;

  const c = detail.construction;
  async function submitReport() {
    await fetch("/api/error-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ surfaceId, reasons, comment }) });
    setSent(true);
  }

  return (
    <div className="h-full overflow-auto p-3 text-sm">
      <h2 className="font-semibold">{c.address}</h2>
      <p className="text-slate-500">Сторона {detail.sideCode} · {c.type} · {c.format}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1">
        <dt className="text-slate-500">№ Конструкции</dt><dd>{c.constructionNumber}</dd>
        <dt className="text-slate-500">Владелец</dt><dd>{c.ownerName}</dd>
        <dt className="text-slate-500">Район</dt><dd>{c.district}</dd>
        <dt className="text-slate-500">Свет</dt><dd>{c.lighting ? "есть" : "нет"}</dd>
        <dt className="text-slate-500">GRP / OTS</dt><dd>{detail.grp ?? "—"} / {detail.ots ?? "—"}</dd>
        <dt className="text-slate-500">Координаты</dt><dd>{c.lat.toFixed(5)}, {c.lng.toFixed(5)}</dd>
      </dl>
      {c.description && <p className="mt-2 text-slate-600">{c.description}</p>}

      <h3 className="mt-4 mb-1 font-medium">Занятость по месяцам</h3>
      <AvailabilityCalendar months={detail.months} />

      <h3 className="mt-4 mb-1 font-medium">Ошибки, неточности</h3>
      {sent ? <p className="text-green-600">Спасибо, отправлено.</p> : (
        <div className="space-y-1">
          {REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2"><input type="checkbox" checked={reasons.includes(r)} onChange={(e) => setReasons(e.target.checked ? [...reasons, r] : reasons.filter((x) => x !== r))} />{r}</label>
          ))}
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий" className="w-full rounded-md border p-1" />
          <button onClick={submitReport} className="rounded-md bg-slate-900 px-3 py-1 text-white">Отправить</button>
        </div>
      )}
    </div>
  );
}
