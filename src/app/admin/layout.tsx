import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";

const NAV = [
  { href: "/admin", label: "Дашборд" },
  { href: "/admin/owners", label: "Владельцы" },
  { href: "/admin/clients", label: "Клиенты" },
  { href: "/admin/constructions", label: "Конструкции" },
  { href: "/admin/import", label: "Импорт фида" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r bg-white p-3">
        <div className="mb-4 font-semibold">Админка FD</div>
        <nav className="flex flex-col gap-1 text-sm">
          {NAV.map((n) => <Link key={n.href} href={n.href} className="rounded-md px-2 py-1 hover:bg-slate-100">{n.label}</Link>)}
          <Link href="/workspace" className="mt-4 rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100">← В рабочий стол</Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
