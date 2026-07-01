"use client";
import { useCallback, useEffect, useState } from "react";
import type { SurfaceListDTO } from "./SurfaceList";

interface ListMeta { id: string; name: string; count: number }

export function WorkingListsPanel({ reloadKey, onChanged, onLoadToMap }: { reloadKey: number; onChanged: () => void; onLoadToMap: (items: SurfaceListDTO[]) => void }) {
  const [lists, setLists] = useState<ListMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<SurfaceListDTO[]>([]);
  const [raw, setRaw] = useState("");

  const loadLists = useCallback(async () => {
    const d = await fetch("/api/working-lists").then((r) => r.json());
    setLists(d.lists ?? []);
    if (!activeId && d.lists?.[0]) setActiveId(d.lists[0].id);
  }, [activeId]);

  useEffect(() => { loadLists(); }, [reloadKey, loadLists]);
  useEffect(() => {
    if (!activeId) { setItems([]); return; }
    fetch(`/api/working-lists/${activeId}`).then((r) => r.json()).then((d) => setItems(d.items ?? [])).catch(() => setItems([]));
  }, [activeId]);

  async function createList() {
    const name = prompt("Название списка", `Список ${lists.length + 1}`);
    if (!name) return;
    const d = await fetch("/api/working-lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).then((r) => r.json());
    setActiveId(d.id); onChanged();
  }
  async function rename() {
    if (!activeId) return;
    const name = prompt("Новое название"); if (!name) return;
    await fetch(`/api/working-lists/${activeId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    onChanged();
  }
  async function remove() {
    if (!activeId) return;
    await fetch(`/api/working-lists/${activeId}`, { method: "DELETE" });
    setActiveId(null); onChanged();
  }
  async function addByIds() {
    if (!activeId || !raw.trim()) return;
    await fetch(`/api/working-lists/${activeId}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw }) });
    setRaw(""); const d = await fetch(`/api/working-lists/${activeId}`).then((r) => r.json()); setItems(d.items ?? []); onChanged();
  }

  return (
    <div className="flex h-full flex-col p-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-semibold">Рабочие списки</span>
        <button onClick={createList} className="ml-auto rounded-md border px-2 py-0.5">+ список</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {lists.map((l) => (
          <button key={l.id} onClick={() => setActiveId(l.id)} className={`rounded-md border px-2 py-0.5 ${activeId === l.id ? "bg-slate-900 text-white" : ""}`}>{l.name} ({l.count})</button>
        ))}
      </div>
      {activeId && (
        <>
          <div className="mt-2 flex gap-1">
            <button onClick={rename} className="rounded-md border px-2 py-0.5">Переименовать</button>
            <button onClick={remove} className="rounded-md border px-2 py-0.5">Удалить</button>
            <button onClick={() => onLoadToMap(items)} className="rounded-md border px-2 py-0.5">На карту</button>
            <a href={`/api/working-lists/${activeId}/export`} className="rounded-md border px-2 py-0.5">Excel</a>
          </div>
          <div className="mt-2 flex gap-1">
            <textarea value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="№ поверхностей через пробел/запятую" className="flex-1 rounded-md border p-1" />
            <button onClick={addByIds} className="rounded-md bg-slate-900 px-2 text-white">Добавить</button>
          </div>
          <div className="mt-2 flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50"><tr><th className="px-1 text-left">Адрес</th><th className="px-1 text-left">Ст</th><th className="px-1 text-left">Владелец</th></tr></thead>
              <tbody>{items.map((it) => <tr key={it.id} className="border-b"><td className="px-1">{it.address}</td><td className="px-1">{it.sideCode}</td><td className="px-1">{it.ownerName}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
