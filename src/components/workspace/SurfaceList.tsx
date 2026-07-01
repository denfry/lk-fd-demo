"use client";
import { useState } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type VisibilityState } from "@tanstack/react-table";
import { STATUS_COLORS, STATUS_LABELS, type AvailabilityStatus } from "@/lib/domain/availability";

export interface SurfaceListDTO { id: string; lat: number; lng: number; address: string; district: string; format: string; type: string; ownerName: string; sideCode: string; status: AvailabilityStatus }

const columns: ColumnDef<SurfaceListDTO>[] = [
  { accessorKey: "address", header: "Адрес" },
  { accessorKey: "district", header: "Район" },
  { accessorKey: "ownerName", header: "Владелец" },
  { accessorKey: "type", header: "Тип" },
  { accessorKey: "format", header: "Формат" },
  { accessorKey: "sideCode", header: "Сторона" },
  { accessorKey: "status", header: "Статус", cell: (c) => {
      const s = c.getValue<AvailabilityStatus>();
      return <span className="inline-flex items-center gap-1"><span style={{ background: STATUS_COLORS[s] }} className="h-2 w-2 rounded-full" />{STATUS_LABELS[s]}</span>;
  } },
];

export function SurfaceList({ surfaces, onSelect }: { surfaces: SurfaceListDTO[]; onSelect: (id: string) => void }) {
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const table = useReactTable({ data: surfaces, columns, state: { columnVisibility: visibility }, onColumnVisibilityChange: setVisibility, getCoreRowModel: getCoreRowModel() });
  return (
    <div className="flex h-full flex-col">
      <details className="border-b p-2 text-sm">
        <summary className="cursor-pointer">Колонки</summary>
        <div className="flex flex-wrap gap-3 pt-2">
          {table.getAllLeafColumns().map((col) => (
            <label key={col.id} className="flex items-center gap-1">
              <input type="checkbox" checked={col.getIsVisible()} onChange={col.getToggleVisibilityHandler()} />
              {typeof col.columnDef.header === "string" ? col.columnDef.header : col.id}
            </label>
          ))}
        </div>
      </details>
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-slate-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id} className="border-b px-2 py-1 text-left font-medium">{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onSelect(row.original.id)}>
                {row.getVisibleCells().map((cell) => <td key={cell.id} className="border-b px-2 py-1">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
