"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/admin/client";
import { DataTable } from "@/components/admin/DataTable";

interface Item { id: string; constructionNumber: string; ownerName: string; type: string; format: string; district: string; address: string; surfaceCount: number }
interface Owner { id: string; name: string }
interface Month { period: string; status: string; priceNet: number | null; priceGross: number | null }
const STATUSES = ["FREE", "SOLD", "RESERVED_OTHER", "NEEDS_CHECK"];

export function ConstructionsClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [q, setQ] = useState("");
  const [owners, setOwners] = useState<Owner[]>([]);
  const [editSurface, setEditSurface] = useState<{ constructionId: string; surfaces: { id: string; sideCode: string }[] } | null>(null);
  const [months, setMonths] = useState<Month[]>([]);
  const [activeSurface, setActiveSurface] = useState<string | null>(null);
  const [newC, setNewC] = useState({ ownerId: "", constructionNumber: "", type: "Билборд 3х6", format: "3х6", district: "", address: "", lat: "59.94", lng: "30.34", sides: "А,Б" });

  const load = useCallback(async () => {
    const d = await api<{ total: number; items: Item[] }>(`/api/admin/constructions?q=${encodeURIComponent(q)}&skip=${skip}&take=25`);
    setItems(d.items); setTotal(d.total);
  }, [q, skip]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api<{ owners: Owner[] }>("/api/admin/owners").then((d) => setOwners(d.owners)); }, []);

  async function create() {
    if (!newC.ownerId || !newC.constructionNumber || !newC.address) return alert("Заполните владельца, № и адрес");
    const sides = newC.sides.split(",").map((s) => s.trim()).filter(Boolean).map((sideCode) => ({ sideCode }));
    await api("/api/admin/constructions", { method: "POST", body: JSON.stringify({ ...newC, lat: Number(newC.lat), lng: Number(newC.lng), lighting: true, sides }) });
    setNewC({ ...newC, constructionNumber: "", address: "" }); await load();
  }
  async function openEditor(constructionId: string) {
    const c = await api<{ surfaces: { id: string; sideCode: string }[] }>(`/api/admin/constructions/${constructionId}`);
    setEditSurface({ constructionId, surfaces: c.surfaces }); setActiveSurface(c.surfaces[0]?.id ?? null);
  }
  useEffect(() => {
    if (!activeSurface) { setMonths([]); return; }
    api<{ months: Month[] }>(`/api/admin/surfaces/${activeSurface}/availability`).then((d) => setMonths(d.months));
  }, [activeSurface]);
  async function saveMonths() {
    if (!activeSurface) return;
    await api(`/api/admin/surfaces/${activeSurface}/availability`, { method: "PUT", body: JSON.stringify({ months }) });
    alert("Сохранено");
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Конструкции</h1>

      <details className="mb-4 rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">+ Новая конструкция</summary>
        <div className="mt-2 grid max-w-3xl grid-cols-3 gap-2 text-sm">
          <select value={newC.ownerId} onChange={(e) => setNewC({ ...newC, ownerId: e.target.value })} className="rounded-md border px-2 py-1">
            <option value="">Владелец*</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <input value={newC.constructionNumber} onChange={(e) => setNewC({ ...newC, constructionNumber: e.target.value })} placeholder="№ конструкции*" className="rounded-md border px-2 py-1" />
          <input value={newC.district} onChange={(e) => setNewC({ ...newC, district: e.target.value })} placeholder="Район" className="rounded-md border px-2 py-1" />
          <input value={newC.address} onChange={(e) => setNewC({ ...newC, address: e.target.value })} placeholder="Адрес*" className="col-span-2 rounded-md border px-2 py-1" />
          <input value={newC.sides} onChange={(e) => setNewC({ ...newC, sides: e.target.value })} placeholder="Стороны (А,Б)" className="rounded-md border px-2 py-1" />
          <input value={newC.lat} onChange={(e) => setNewC({ ...newC, lat: e.target.value })} placeholder="Широта" className="rounded-md border px-2 py-1" />
          <input value={newC.lng} onChange={(e) => setNewC({ ...newC, lng: e.target.value })} placeholder="Долгота" className="rounded-md border px-2 py-1" />
          <button onClick={create} className="rounded-md bg-slate-900 px-3 py-1 text-white">Создать</button>
        </div>
      </details>

      <div className="mb-2 flex items-center gap-2">
        <input value={q} onChange={(e) => { setSkip(0); setQ(e.target.value); }} placeholder="Поиск по адресу/№" className="rounded-md border px-2 py-1 text-sm" />
        <span className="text-sm text-slate-500">Всего: {total}</span>
        <div className="ml-auto flex gap-1">
          <button disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - 25))} className="rounded-md border px-2 py-1 text-sm disabled:opacity-40">←</button>
          <button disabled={skip + 25 >= total} onClick={() => setSkip(skip + 25)} className="rounded-md border px-2 py-1 text-sm disabled:opacity-40">→</button>
        </div>
      </div>

      <DataTable
        rows={items}
        columns={[
          { key: "constructionNumber", header: "№" },
          { key: "ownerName", header: "Владелец" },
          { key: "address", header: "Адрес" },
          { key: "surfaceCount", header: "Сторон" },
          { key: "actions", header: "", render: (c) => <button onClick={() => openEditor(c.id)} className="text-blue-600">занятость</button> },
        ]}
      />

      {editSurface && (
        <div className="mt-4 rounded-md border p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium">Занятость сторон:</span>
            {editSurface.surfaces.map((s) => (
              <button key={s.id} onClick={() => setActiveSurface(s.id)} className={`rounded-md border px-2 py-0.5 text-sm ${activeSurface === s.id ? "bg-slate-900 text-white" : ""}`}>{s.sideCode}</button>
            ))}
            <button onClick={() => setEditSurface(null)} className="ml-auto text-sm text-slate-500">закрыть</button>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {months.map((m, i) => (
              <div key={m.period} className="rounded-md border p-2 text-xs">
                <div className="font-medium">{m.period}</div>
                <select value={m.status} onChange={(e) => setMonths(months.map((x, j) => j === i ? { ...x, status: e.target.value } : x))} className="mt-1 w-full rounded border px-1 py-0.5">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input type="number" value={m.priceNet ?? ""} onChange={(e) => setMonths(months.map((x, j) => j === i ? { ...x, priceNet: e.target.value ? Number(e.target.value) : null } : x))} placeholder="цена net" className="mt-1 w-full rounded border px-1 py-0.5" />
              </div>
            ))}
          </div>
          <button onClick={saveMonths} className="mt-2 rounded-md bg-slate-900 px-3 py-1 text-sm text-white">Сохранить занятость</button>
        </div>
      )}
    </div>
  );
}
