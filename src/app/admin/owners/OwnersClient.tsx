"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/admin/client";
import { DataTable } from "@/components/admin/DataTable";

interface Owner { id: string; name: string; site: string | null; phone: string | null; email: string | null; contactPerson: string | null }
const EMPTY = { name: "", site: "", phone: "", email: "", contactPerson: "" };

export function OwnersClient() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [form, setForm] = useState<typeof EMPTY & { id?: string }>(EMPTY);

  async function load() { setOwners((await api<{ owners: Owner[] }>("/api/admin/owners")).owners); }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.name.trim()) return;
    if (form.id) await api(`/api/admin/owners/${form.id}`, { method: "PATCH", body: JSON.stringify(form) });
    else await api("/api/admin/owners", { method: "POST", body: JSON.stringify(form) });
    setForm(EMPTY); await load();
  }
  async function remove(id: string) {
    try { await api(`/api/admin/owners/${id}`, { method: "DELETE" }); await load(); }
    catch { alert("Нельзя удалить: у владельца есть конструкции"); }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Владельцы</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["name", "site", "phone", "email", "contactPerson"] as const).map((k) => (
          <input key={k} value={(form[k] as string) ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            placeholder={k === "name" ? "Название*" : k} className="rounded-md border px-2 py-1 text-sm" />
        ))}
        <button onClick={save} className="rounded-md bg-slate-900 px-3 py-1 text-sm text-white">{form.id ? "Сохранить" : "Добавить"}</button>
        {form.id && <button onClick={() => setForm(EMPTY)} className="rounded-md border px-3 py-1 text-sm">Отмена</button>}
      </div>
      <DataTable
        rows={owners}
        columns={[
          { key: "name", header: "Название" },
          { key: "email", header: "E-mail" },
          { key: "phone", header: "Телефон" },
          { key: "actions", header: "", render: (o) => (
            <span className="flex gap-2">
              <button onClick={() => setForm({ id: o.id, name: o.name, site: o.site ?? "", phone: o.phone ?? "", email: o.email ?? "", contactPerson: o.contactPerson ?? "" })} className="text-blue-600">ред.</button>
              <button onClick={() => remove(o.id)} className="text-red-600">удал.</button>
            </span>
          ) },
        ]}
      />
    </div>
  );
}
