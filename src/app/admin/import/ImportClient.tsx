"use client";
import { useState } from "react";

interface Result { created: number; updated: number; errors: { line: number; message: string }[] }
const HEADERS = "ownerName,constructionNumber,ownerNumber,type,format,district,address,lat,lng,lighting,sideCode,direction,surfaceNumber,gid,grp,ots,period,status,priceNet";

export function ImportClient() {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true); setResult(null);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/admin/feed-import", { method: "POST", body: fd });
    setResult(await res.json()); setBusy(false);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">Импорт фида</h1>
      <p className="mb-2 text-sm text-slate-600">Формат — CSV или XLSX с колонками:</p>
      <code className="mb-4 block overflow-auto rounded-md bg-slate-100 p-2 text-xs">{HEADERS}</code>
      <input type="file" accept=".csv,.xlsx" disabled={busy}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      {busy && <p className="mt-3 text-sm text-slate-500">Импорт…</p>}
      {result && (
        <div className="mt-4 rounded-md border p-3 text-sm">
          <p>Создано: <b>{result.created}</b>, обновлено: <b>{result.updated}</b>, ошибок: <b>{result.errors.length}</b></p>
          {result.errors.length > 0 && (
            <ul className="mt-2 max-h-40 overflow-auto text-xs text-red-600">
              {result.errors.map((e, i) => <li key={i}>строка {e.line}: {e.message}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
