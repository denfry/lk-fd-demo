"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/admin/client";
import { DataTable } from "@/components/admin/DataTable";

interface Row { id: string; name: string; email: string | null; phone: string | null; userCount: number }

export function ClientsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", userEmail: "", userPassword: "", userName: "" });

  async function load() { setRows((await api<{ clients: Row[] }>("/api/admin/clients")).clients); }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.name.trim()) return;
    const body: Record<string, unknown> = { name: form.name, email: form.email || null, phone: form.phone || null };
    if (form.userEmail && form.userPassword) body.user = { email: form.userEmail, password: form.userPassword, name: form.userName || form.name };
    await api("/api/admin/clients", { method: "POST", body: JSON.stringify(body) });
    setForm({ name: "", email: "", phone: "", userEmail: "", userPassword: "", userName: "" }); await load();
  }
  async function remove(id: string) {
    try { await api(`/api/admin/clients/${id}`, { method: "DELETE" }); await load(); }
    catch { alert("Нельзя удалить: у клиента есть пользователи или списки"); }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Клиенты</h1>
      <div className="mb-4 grid max-w-3xl grid-cols-3 gap-2">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Название*" className="rounded-md border px-2 py-1 text-sm" />
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-mail" className="rounded-md border px-2 py-1 text-sm" />
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Телефон" className="rounded-md border px-2 py-1 text-sm" />
        <input value={form.userEmail} onChange={(e) => setForm({ ...form, userEmail: e.target.value })} placeholder="Логин пользователя" className="rounded-md border px-2 py-1 text-sm" />
        <input value={form.userPassword} onChange={(e) => setForm({ ...form, userPassword: e.target.value })} placeholder="Пароль (мин.6)" className="rounded-md border px-2 py-1 text-sm" />
        <button onClick={create} className="rounded-md bg-slate-900 px-3 py-1 text-sm text-white">Добавить клиента</button>
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: "name", header: "Название" },
          { key: "email", header: "E-mail" },
          { key: "userCount", header: "Пользователей" },
          { key: "actions", header: "", render: (r) => <button onClick={() => remove(r.id)} className="text-red-600">удал.</button> },
        ]}
      />
    </div>
  );
}
