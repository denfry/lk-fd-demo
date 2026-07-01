"use client";
import type { ReactNode } from "react";

export interface Column<T> { key: string; header: string; render?: (row: T) => ReactNode }

export function DataTable<T extends { id: string }>({ rows, columns, onRowClick }: { rows: T[]; columns: Column<T>[]; onRowClick?: (row: T) => void }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead className="bg-slate-50">
        <tr>{columns.map((c) => <th key={c.key} className="border-b px-2 py-1 text-left font-medium">{c.header}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className={onRowClick ? "cursor-pointer hover:bg-slate-50" : ""} onClick={() => onRowClick?.(row)}>
            {columns.map((c) => <td key={c.key} className="border-b px-2 py-1">{c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
