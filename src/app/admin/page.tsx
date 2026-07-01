import { loadAdminStats } from "@/lib/admin/stats";

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

export default async function AdminHome() {
  const s = await loadAdminStats();
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Дашборд</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card label="Владельцы" value={s.owners} />
        <Card label="Клиенты" value={s.clients} />
        <Card label="Конструкции" value={s.constructions} />
        <Card label="Поверхности" value={s.surfaces} />
        <Card label="Занятость, %" value={`${s.occupancyPct}%`} />
      </div>
    </div>
  );
}
