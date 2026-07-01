# ЛК FD — Админка + Импорт фидов. Implementation Plan (План 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить административную панель поверх готового фундамента: управление владельцами, клиентами/пользователями, конструкциями/сторонами/ценами, импорт нормализованного фида и дашборд со статистикой.

**Architecture:** Продолжение Плана 1 (уже в `master`). Те же Next.js 16 App Router + Prisma 6 + Auth.js v5. Админка живёт под `/admin`, доступна только роли `ADMIN`: ограничение вводится и в edge-middleware (проверка `token.role` в `authConfig.authorized`), и на сервере (`requireAdmin()` в layout — защита в глубину). CRUD-эндпоинты — под `/api/admin/*`, каждый начинается с `requireAdmin()`. Парсинг фида — чистая функция в `src/lib/domain/feed.ts` (unit-тест), апсерт в БД — в API-роуте.

**Tech Stack:** те же, что в Плане 1. Дополнительно: `papaparse` для CSV (детерминированный парсинг), существующий `exceljs` умеет читать xlsx.

## Global Constraints

- Продолжает ветку `master` (План 1 смёржен). Новая рабочая ветка: `feat/admin`.
- Next.js 16 App Router, TypeScript strict. Prisma 6.x. Язык UI — русский.
- Роли: `ADMIN` — полный доступ к `/admin`; `CLIENT` — НЕ имеет доступа (редирект на `/workspace`).
- Все `/api/admin/*` роуты обязаны вызывать `requireAdmin()` первым делом и возвращать `403` для не-админа, `401` без сессии.
- Периоды — первое число месяца, UTC. Статусы занятости — `FREE | SOLD | RESERVED_OTHER | NEEDS_CHECK` (из `@/lib/domain/availability`).
- Демо-админ: `admin@demo` / `demo1234` (уже в seed).
- Импорт — ОДИН нормализованный формат (CSV или XLSX с теми же колонками). Никакого парсинга «экзотических» форматов владельцев (YAGNI).
- Каждая задача заканчивается коммитом. Все команды — из корня проекта.

---

## File Structure (новое/изменяемое)

```
src/lib/auth.config.ts             # ИЗМЕНИТЬ: authorized() требует role=ADMIN для /admin
src/lib/admin/guard.ts             # requireAdmin() серверный хелпер
src/lib/admin/stats.ts             # агрегаты для дашборда
src/lib/domain/feed.ts             # парсер+валидатор строк фида (чистый, unit-тест)
src/app/admin/layout.tsx           # requireAdmin + сайдбар-навигация
src/app/admin/page.tsx             # дашборд
src/app/admin/owners/page.tsx      # владельцы (клиентская таблица+форма)
src/app/admin/clients/page.tsx     # клиенты+пользователи
src/app/admin/constructions/page.tsx  # конструкции/стороны/цены
src/app/admin/import/page.tsx      # импорт фида
src/app/api/admin/owners/route.ts          # GET, POST
src/app/api/admin/owners/[id]/route.ts     # PATCH, DELETE
src/app/api/admin/clients/route.ts         # GET, POST (+ создание пользователя)
src/app/api/admin/clients/[id]/route.ts    # PATCH, DELETE
src/app/api/admin/constructions/route.ts   # GET (пагинация), POST (конструкция+стороны)
src/app/api/admin/constructions/[id]/route.ts   # GET, PATCH, DELETE
src/app/api/admin/surfaces/[id]/availability/route.ts  # PUT (перезапись цен/статусов по месяцам)
src/app/api/admin/feed-import/route.ts     # POST (файл) -> upsert + FeedImport
src/components/admin/DataTable.tsx         # простая переиспользуемая таблица
src/components/admin/CrudForm.tsx          # generic форма полей
tests/unit/feed.test.ts
tests/e2e/admin.spec.ts
```

---

## Task 1: Ролевой доступ к /admin + оболочка админки

**Files:**
- Modify: `src/lib/auth.config.ts`
- Create: `src/lib/admin/guard.ts`, `src/app/admin/layout.tsx`, `src/app/admin/page.tsx` (заглушка)

**Interfaces:**
- Consumes: `auth` из `@/lib/auth`.
- Produces: `async function requireAdmin(): Promise<Session>` из `@/lib/admin/guard` — редиректит на `/workspace` (не-админ) или `/login` (нет сессии), иначе возвращает сессию.

- [ ] **Step 1: Требовать аутентификацию для /admin в edge-middleware**

Edge-слой проверяет только аутентификацию (аноним → `/login`). Ролевое
ограничение (только ADMIN; не-админ → `/workspace`) делает серверный
`requireAdmin()` в layout — иначе NextAuth при `authorized:false` шлёт
залогиненного клиента на `/login`, а не на `/workspace`.

В `src/lib/auth.config.ts`, заменить `authorized`:
```ts
authorized({ auth, request }) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/admin") || path.startsWith("/workspace")) return !!auth?.user;
  return true;
},
```

- [ ] **Step 2: Серверный guard**

Create `src/lib/admin/guard.ts`:
```ts
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/workspace");
  return session;
}
```

- [ ] **Step 3: Layout админки с навигацией**

Create `src/app/admin/layout.tsx`:
```tsx
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
```

Create `src/app/admin/page.tsx` (временная заглушка, наполним в Task 2):
```tsx
export default function AdminHome() {
  return <h1 className="text-xl font-semibold">Дашборд</h1>;
}
```

- [ ] **Step 4: Проверка доступа**

Run: `npm run dev`; войти как `client@demo` → перейти на `/admin` → редирект на `/workspace`. Войти как `admin@demo` → `/admin` открывается, виден сайдбар.
Expected: клиент не пускается, админ пускается.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.config.ts src/lib/admin/guard.ts src/app/admin
git commit -m "feat(admin): role-gated admin shell with nav"
```

---

## Task 2: Дашборд со статистикой

**Files:**
- Create: `src/lib/admin/stats.ts`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `prisma`.
- Produces: `async function loadAdminStats(): Promise<{ owners: number; clients: number; constructions: number; surfaces: number; occupancyPct: number }>` — `occupancyPct` = доля записей `Availability` со статусом, отличным от `FREE`, в процентах (0–100, округлённо).

- [ ] **Step 1: Агрегаты**

Create `src/lib/admin/stats.ts`:
```ts
import { prisma } from "@/lib/db";

export async function loadAdminStats() {
  const [owners, clients, constructions, surfaces, total, free] = await Promise.all([
    prisma.owner.count(),
    prisma.client.count(),
    prisma.construction.count(),
    prisma.surface.count(),
    prisma.availability.count(),
    prisma.availability.count({ where: { status: "FREE" } }),
  ]);
  const occupancyPct = total === 0 ? 0 : Math.round(((total - free) / total) * 100);
  return { owners, clients, constructions, surfaces, occupancyPct };
}
```

- [ ] **Step 2: Дашборд**

Replace `src/app/admin/page.tsx`:
```tsx
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
```

- [ ] **Step 3: Проверка**

Run: `npm run dev` → `/admin` под админом показывает 5 карточек с цифрами (владельцы 9, поверхности 200 и т.д.).
Expected: цифры соответствуют seed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/admin/stats.ts src/app/admin/page.tsx
git commit -m "feat(admin): dashboard with counts and occupancy"
```

---

## Task 3: Переиспользуемые DataTable и админ-fetch хелпер

**Files:**
- Create: `src/components/admin/DataTable.tsx`, `src/lib/admin/client.ts`

**Interfaces:**
- Produces:
  - `DataTable<T>({ rows, columns, onRowClick? })` — `columns: { key: keyof T | string; header: string; render?: (row: T) => React.ReactNode }[]`.
  - `src/lib/admin/client.ts`: `async function api<T>(url: string, init?: RequestInit): Promise<T>` — обёртка `fetch` с `Content-Type: application/json`, бросает на не-2xx.

- [ ] **Step 1: fetch-хелпер**

Create `src/lib/admin/client.ts`:
```ts
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
```

- [ ] **Step 2: DataTable**

Create `src/components/admin/DataTable.tsx`:
```tsx
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
```

- [ ] **Step 3: Проверка сборки**

Run: `npm run build`
Expected: без ошибок типов.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/DataTable.tsx src/lib/admin/client.ts
git commit -m "feat(admin): reusable DataTable and api fetch helper"
```

---

## Task 4: Владельцы — CRUD API

**Files:**
- Create: `src/app/api/admin/owners/route.ts`, `src/app/api/admin/owners/[id]/route.ts`

**Interfaces:**
- Consumes: `requireAdmin`? — API нельзя редиректить, поэтому нужен НЕ-редиректящий вариант. Использовать `auth()` напрямую и вернуть коды.
- Produces:
  - `GET /api/admin/owners` → `{ owners: Owner[] }`
  - `POST /api/admin/owners` `{ name, site?, phone?, email?, contactPerson? }` → `{ id }`
  - `PATCH /api/admin/owners/[id]` (те же поля, все опц.) → `{ ok: true }`
  - `DELETE /api/admin/owners/[id]` → `{ ok: true }` или `409`, если есть конструкции.
  - Хелпер `src/lib/admin/api-guard.ts`: `async function assertAdmin(): Promise<NextResponse | null>` — `null` если админ, иначе `401/403` ответ.

- [ ] **Step 1: API-guard (без редиректа)**

Create `src/lib/admin/api-guard.ts`:
```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function assertAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return null;
}
```

- [ ] **Step 2: Коллекция владельцев**

Create `src/app/api/admin/owners/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/api-guard";

const OwnerInput = z.object({
  name: z.string().min(1).max(200),
  site: z.string().max(300).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  contactPerson: z.string().max(200).optional().nullable(),
});

export async function GET() {
  const deny = await assertAdmin(); if (deny) return deny;
  const owners = await prisma.owner.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ owners });
}

export async function POST(req: NextRequest) {
  const deny = await assertAdmin(); if (deny) return deny;
  const parsed = OwnerInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const owner = await prisma.owner.create({ data: parsed.data });
  return NextResponse.json({ id: owner.id });
}
```

- [ ] **Step 3: Элемент владельца**

Create `src/app/api/admin/owners/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/api-guard";

const Patch = z.object({
  name: z.string().min(1).max(200).optional(),
  site: z.string().max(300).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  contactPerson: z.string().max(200).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await prisma.owner.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  const count = await prisma.construction.count({ where: { ownerId: id } });
  if (count > 0) return NextResponse.json({ error: "owner has constructions" }, { status: 409 });
  await prisma.owner.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Проверка**

Run: `npm run dev`; под админом (cookie) `curl` POST владельца, GET списка (появился), PATCH имени, DELETE (для нового — ок; для владельца с конструкциями — 409).
Expected: CRUD работает, 409 для непустого владельца.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/owners src/lib/admin/api-guard.ts
git commit -m "feat(admin): owners CRUD API"
```

---

## Task 5: Владельцы — UI

**Files:**
- Create: `src/app/admin/owners/page.tsx`, `src/app/admin/owners/OwnersClient.tsx`

**Interfaces:**
- Consumes: `api`, `DataTable`, `/api/admin/owners*`.

- [ ] **Step 1: Клиентский экран**

Create `src/app/admin/owners/OwnersClient.tsx`:
```tsx
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
          <input key={k} value={(form as any)[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
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
```

Create `src/app/admin/owners/page.tsx`:
```tsx
import { OwnersClient } from "./OwnersClient";
export default function Page() { return <OwnersClient />; }
```

- [ ] **Step 2: Проверка**

Run: `npm run dev` → `/admin/owners`: добавить владельца, отредактировать, удалить (нового). Список обновляется.
Expected: CRUD из UI работает.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/owners
git commit -m "feat(admin): owners management UI"
```

---

## Task 6: Клиенты и пользователи — API

**Files:**
- Create: `src/app/api/admin/clients/route.ts`, `src/app/api/admin/clients/[id]/route.ts`

**Interfaces:**
- Produces:
  - `GET /api/admin/clients` → `{ clients: { id, name, email, phone, userCount }[] }`
  - `POST /api/admin/clients` `{ name, email?, phone?, contactPerson?, user?: { email, password, name } }` → `{ id }`; если задан `user` — создаёт пользователя роли `CLIENT` с bcrypt-хэшем, привязанного к клиенту.
  - `PATCH /api/admin/clients/[id]` — поля клиента.
  - `DELETE /api/admin/clients/[id]` → `409`, если есть рабочие списки или пользователи.

- [ ] **Step 1: Коллекция клиентов**

Create `src/app/api/admin/clients/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/api-guard";

const Input = z.object({
  name: z.string().min(1).max(200),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  contactPerson: z.string().max(200).optional().nullable(),
  // Login identifier (не строгий email) — демо-конвенция использует логины без TLD
  // (client@demo / admin@demo); вход трактует его непрозрачно.
  user: z.object({ email: z.string().min(3).max(200), password: z.string().min(6), name: z.string().min(1) }).optional(),
});

export async function GET() {
  const deny = await assertAdmin(); if (deny) return deny;
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } });
  return NextResponse.json({ clients: clients.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, userCount: c._count.users })) });
}

export async function POST(req: NextRequest) {
  const deny = await assertAdmin(); if (deny) return deny;
  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { user, ...clientData } = parsed.data;
  const client = await prisma.client.create({ data: clientData });
  if (user) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await prisma.user.create({ data: { email: user.email, name: user.name, passwordHash, role: "CLIENT", clientId: client.id } });
  }
  return NextResponse.json({ id: client.id });
}
```

- [ ] **Step 2: Элемент клиента**

Create `src/app/api/admin/clients/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/api-guard";

const Patch = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  contactPerson: z.string().max(200).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await prisma.client.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  const [lists, users] = await Promise.all([
    prisma.workingList.count({ where: { clientId: id } }),
    prisma.user.count({ where: { clientId: id } }),
  ]);
  if (lists > 0 || users > 0) return NextResponse.json({ error: "client has users or lists" }, { status: 409 });
  await prisma.client.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Проверка**

Run: под админом `curl` POST клиента с `user` → создаются client+user; GET списка показывает `userCount: 1`; попытка DELETE такого клиента → 409.
Expected: создание клиента с пользователем и защита от удаления работают.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/clients
git commit -m "feat(admin): clients + users CRUD API"
```

---

## Task 7: Клиенты — UI

**Files:**
- Create: `src/app/admin/clients/page.tsx`, `src/app/admin/clients/ClientsClient.tsx`

**Interfaces:**
- Consumes: `api`, `DataTable`, `/api/admin/clients*`.

- [ ] **Step 1: Экран клиентов**

Create `src/app/admin/clients/ClientsClient.tsx`:
```tsx
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
    const body: any = { name: form.name, email: form.email || null, phone: form.phone || null };
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
```

Create `src/app/admin/clients/page.tsx`:
```tsx
import { ClientsClient } from "./ClientsClient";
export default function Page() { return <ClientsClient />; }
```

- [ ] **Step 2: Проверка**

Run: `/admin/clients` → добавить клиента с логином/паролем; в списке `Пользователей: 1`. Проверить вход этим новым пользователем на `/login`.
Expected: клиент+пользователь создаются, новый пользователь может войти.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/clients
git commit -m "feat(admin): clients management UI"
```

---

## Task 8: Конструкции и стороны — API

**Files:**
- Create: `src/app/api/admin/constructions/route.ts`, `src/app/api/admin/constructions/[id]/route.ts`

**Interfaces:**
- Produces:
  - `GET /api/admin/constructions?owner=&q=&skip=&take=` → `{ total, items: { id, constructionNumber, ownerName, type, format, district, address, surfaceCount }[] }` (пагинация, `take`≤100).
  - `POST /api/admin/constructions` `{ ownerId, constructionNumber, ownerNumber?, type, format, district, address, lat, lng, lighting, sides: { sideCode, direction?, surfaceNumber?, gid?, grp?, ots? }[] }` → `{ id }` (создаёт конструкцию + стороны).
  - `GET /api/admin/constructions/[id]` → конструкция со сторонами.
  - `PATCH /api/admin/constructions/[id]` — поля конструкции.
  - `DELETE /api/admin/constructions/[id]` → каскадно удаляет стороны/занятость (уже `onDelete: Cascade`).

- [ ] **Step 1: Коллекция конструкций**

Create `src/app/api/admin/constructions/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/api-guard";

const SideInput = z.object({
  sideCode: z.string().min(1).max(20),
  direction: z.string().max(50).optional().nullable(),
  surfaceNumber: z.string().max(50).optional().nullable(),
  gid: z.string().max(50).optional().nullable(),
  grp: z.number().optional().nullable(),
  ots: z.number().optional().nullable(),
});
const Input = z.object({
  ownerId: z.string(),
  constructionNumber: z.string().min(1).max(50),
  ownerNumber: z.string().max(50).optional().nullable(),
  type: z.string().min(1).max(100),
  format: z.string().min(1).max(50),
  district: z.string().min(1).max(100),
  address: z.string().min(1).max(500),
  lat: z.number(), lng: z.number(),
  lighting: z.boolean().default(false),
  sides: z.array(SideInput).default([]),
});

export async function GET(req: NextRequest) {
  const deny = await assertAdmin(); if (deny) return deny;
  const sp = req.nextUrl.searchParams;
  const owner = sp.get("owner");
  const q = sp.get("q")?.trim();
  const skip = Number(sp.get("skip") ?? 0);
  const take = Math.min(Number(sp.get("take") ?? 25), 100);
  const where: Record<string, unknown> = {};
  if (owner) where.ownerId = owner;
  if (q) where.OR = [{ address: { contains: q, mode: "insensitive" } }, { constructionNumber: { contains: q } }];
  const [total, rows] = await Promise.all([
    prisma.construction.count({ where }),
    prisma.construction.findMany({ where, skip, take, orderBy: { constructionNumber: "asc" }, include: { owner: true, _count: { select: { surfaces: true } } } }),
  ]);
  return NextResponse.json({ total, items: rows.map((c) => ({ id: c.id, constructionNumber: c.constructionNumber, ownerName: c.owner.name, type: c.type, format: c.format, district: c.district, address: c.address, surfaceCount: c._count.surfaces })) });
}

export async function POST(req: NextRequest) {
  const deny = await assertAdmin(); if (deny) return deny;
  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request", detail: parsed.error.flatten() }, { status: 400 });
  const { sides, ...c } = parsed.data;
  const created = await prisma.construction.create({
    data: { ...c, surfaces: { create: sides.map((s) => ({ ...s })) } },
  });
  return NextResponse.json({ id: created.id });
}
```

- [ ] **Step 2: Элемент конструкции**

Create `src/app/api/admin/constructions/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/api-guard";

const Patch = z.object({
  ownerNumber: z.string().max(50).optional().nullable(),
  type: z.string().max(100).optional(),
  format: z.string().max(50).optional(),
  district: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  lat: z.number().optional(), lng: z.number().optional(),
  lighting: z.boolean().optional(),
  description: z.string().max(2000).optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  const c = await prisma.construction.findUnique({ where: { id }, include: { owner: true, surfaces: true } });
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(c);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await prisma.construction.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  await prisma.construction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Проверка**

Run: под админом `curl` GET списка (пагинация, `total`=100), POST новой конструкции с 2 сторонами, GET её по id (2 стороны), PATCH адреса, DELETE.
Expected: CRUD с вложенными сторонами и пагинацией работает.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/constructions
git commit -m "feat(admin): constructions + sides CRUD API with pagination"
```

---

## Task 9: Редактирование цен/занятости стороны — API

**Files:**
- Create: `src/app/api/admin/surfaces/[id]/availability/route.ts`

**Interfaces:**
- Produces:
  - `GET /api/admin/surfaces/[id]/availability` → `{ months: { period: "YYYY-MM", status, priceNet, priceGross }[] }`
  - `PUT /api/admin/surfaces/[id]/availability` `{ months: { period: "YYYY-MM", status, priceNet?, priceGross? }[] }` → перезаписывает занятость поверхности (upsert по `(surfaceId, period)`), возвращает `{ ok: true }`.

- [ ] **Step 1: Реализация**

Create `src/app/api/admin/surfaces/[id]/availability/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/api-guard";
import { periodKey } from "@/lib/serialize";

const Month = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  status: z.enum(["FREE", "SOLD", "RESERVED_OTHER", "NEEDS_CHECK"]),
  priceNet: z.number().int().optional().nullable(),
  priceGross: z.number().int().optional().nullable(),
});
const Body = z.object({ months: z.array(Month) });

function toDate(p: string) { const [y, m] = p.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)); }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  const rows = await prisma.availability.findMany({ where: { surfaceId: id }, orderBy: { period: "asc" } });
  return NextResponse.json({ months: rows.map((a) => ({ period: periodKey(a.period), status: a.status, priceNet: a.priceNet, priceGross: a.priceGross })) });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await assertAdmin(); if (deny) return deny;
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await prisma.$transaction(parsed.data.months.map((m) =>
    prisma.availability.upsert({
      where: { surfaceId_period: { surfaceId: id, period: toDate(m.period) } },
      create: { surfaceId: id, period: toDate(m.period), status: m.status, priceNet: m.priceNet ?? null, priceGross: m.priceGross ?? null },
      update: { status: m.status, priceNet: m.priceNet ?? null, priceGross: m.priceGross ?? null },
    })
  ));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Проверка**

Run: под админом `curl` PUT занятости для стороны (2-3 месяца), затем GET — значения сохранились; проверить, что в клиентском календаре (карточка) цвета/цены обновились.
Expected: занятость перезаписывается, отражается у клиента.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/surfaces
git commit -m "feat(admin): per-surface availability/prices upsert API"
```

---

## Task 10: Конструкции — UI (список + создание + редактор занятости)

**Files:**
- Create: `src/app/admin/constructions/page.tsx`, `src/app/admin/constructions/ConstructionsClient.tsx`

**Interfaces:**
- Consumes: `api`, `DataTable`, `/api/admin/constructions*`, `/api/admin/owners`, `/api/admin/surfaces/[id]/availability`.

- [ ] **Step 1: Экран (список с поиском/пагинацией, форма создания, редактор занятости стороны)**

Create `src/app/admin/constructions/ConstructionsClient.tsx`:
```tsx
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
```

Create `src/app/admin/constructions/page.tsx`:
```tsx
import { ConstructionsClient } from "./ConstructionsClient";
export default function Page() { return <ConstructionsClient />; }
```

- [ ] **Step 2: Проверка**

Run: `/admin/constructions` → поиск, пагинация; создать конструкцию с 2 сторонами; открыть «занятость», сменить статус/цену месяца, сохранить; проверить в клиентской карточке.
Expected: список, создание и редактор занятости работают, изменения видны клиенту.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/constructions
git commit -m "feat(admin): constructions UI with availability editor"
```

---

## Task 11: Парсер фида (TDD)

**Files:**
- Create: `src/lib/domain/feed.ts`
- Test: `tests/unit/feed.test.ts`

**Interfaces:**
- Produces:
  - `interface FeedRow { ownerName: string; constructionNumber: string; ownerNumber: string | null; type: string; format: string; district: string; address: string; lat: number; lng: number; lighting: boolean; sideCode: string; direction: string | null; surfaceNumber: string | null; gid: string | null; grp: number | null; ots: number | null; period: string; status: AvailabilityStatus; priceNet: number | null }`
  - `interface FeedParseResult { rows: FeedRow[]; errors: { line: number; message: string }[] }`
  - `function parseFeedRecords(records: Record<string, string>[]): FeedParseResult` — валидирует и нормализует массив «сырых» строк (ключи — заголовки CSV). Обязательные: ownerName, constructionNumber, type, format, district, address, lat, lng, sideCode, period, status. `period` — `YYYY-MM`; `status` — из допустимых; числа парсятся, пустые → null. Плохая строка попадает в `errors`, не в `rows`.

- [ ] **Step 1: Падающий тест**

Create `tests/unit/feed.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseFeedRecords } from "@/lib/domain/feed";

const base = {
  ownerName: "РИМ", constructionNumber: "500001", ownerNumber: "12.3", type: "Билборд 3х6", format: "3х6",
  district: "Невский", address: "Ленина пр-т., д.5", lat: "59.93", lng: "30.34", lighting: "да",
  sideCode: "А", direction: "прямое", surfaceNumber: "900001", gid: "500001А", grp: "5.2", ots: "42000",
  period: "2026-07", status: "FREE", priceNet: "120000",
};

describe("parseFeedRecords", () => {
  it("parses a valid record with correct types", () => {
    const { rows, errors } = parseFeedRecords([base]);
    expect(errors).toHaveLength(0);
    expect(rows[0]).toMatchObject({ ownerName: "РИМ", lat: 59.93, lng: 30.34, lighting: true, grp: 5.2, ots: 42000, period: "2026-07", status: "FREE", priceNet: 120000 });
  });
  it("collects errors for missing required fields", () => {
    const { rows, errors } = parseFeedRecords([{ ...base, address: "" }]);
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/address/i);
  });
  it("rejects a bad status and bad period", () => {
    expect(parseFeedRecords([{ ...base, status: "NOPE" }]).errors[0].message).toMatch(/status/i);
    expect(parseFeedRecords([{ ...base, period: "2026/07" }]).errors[0].message).toMatch(/period/i);
  });
  it("maps empty numeric fields to null", () => {
    const { rows } = parseFeedRecords([{ ...base, grp: "", ots: "", priceNet: "" }]);
    expect(rows[0].grp).toBeNull();
    expect(rows[0].ots).toBeNull();
    expect(rows[0].priceNet).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run tests/unit/feed.test.ts`
Expected: FAIL (модуль не найден).

- [ ] **Step 3: Реализация**

Create `src/lib/domain/feed.ts`:
```ts
import type { AvailabilityStatus } from "./availability";

export interface FeedRow {
  ownerName: string; constructionNumber: string; ownerNumber: string | null;
  type: string; format: string; district: string; address: string;
  lat: number; lng: number; lighting: boolean;
  sideCode: string; direction: string | null; surfaceNumber: string | null; gid: string | null;
  grp: number | null; ots: number | null;
  period: string; status: AvailabilityStatus; priceNet: number | null;
}
export interface FeedParseResult { rows: FeedRow[]; errors: { line: number; message: string }[] }

const STATUSES = new Set(["FREE", "SOLD", "RESERVED_OTHER", "NEEDS_CHECK"]);
const REQUIRED = ["ownerName", "constructionNumber", "type", "format", "district", "address", "lat", "lng", "sideCode", "period", "status"];

function num(v: string | undefined): number | null {
  const t = (v ?? "").trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}
function bool(v: string | undefined): boolean {
  return ["да", "1", "true", "yes", "есть"].includes((v ?? "").trim().toLowerCase());
}

export function parseFeedRecords(records: Record<string, string>[]): FeedParseResult {
  const rows: FeedRow[] = [];
  const errors: { line: number; message: string }[] = [];
  records.forEach((r, i) => {
    const line = i + 2; // 1-based + header
    const missing = REQUIRED.filter((k) => !(r[k] ?? "").trim());
    if (missing.length) { errors.push({ line, message: `missing required: ${missing.join(", ")}` }); return; }
    if (!/^\d{4}-\d{2}$/.test(r.period.trim())) { errors.push({ line, message: `bad period: ${r.period}` }); return; }
    if (!STATUSES.has(r.status.trim())) { errors.push({ line, message: `bad status: ${r.status}` }); return; }
    const lat = num(r.lat), lng = num(r.lng), grp = num(r.grp), ots = num(r.ots), priceNet = num(r.priceNet);
    if (lat === null || Number.isNaN(lat) || lng === null || Number.isNaN(lng)) { errors.push({ line, message: `bad lat/lng` }); return; }
    if ([grp, ots, priceNet].some((x) => Number.isNaN(x))) { errors.push({ line, message: `bad numeric field` }); return; }
    rows.push({
      ownerName: r.ownerName.trim(), constructionNumber: r.constructionNumber.trim(),
      ownerNumber: r.ownerNumber?.trim() || null, type: r.type.trim(), format: r.format.trim(),
      district: r.district.trim(), address: r.address.trim(), lat, lng, lighting: bool(r.lighting),
      sideCode: r.sideCode.trim(), direction: r.direction?.trim() || null,
      surfaceNumber: r.surfaceNumber?.trim() || null, gid: r.gid?.trim() || null,
      grp, ots, period: r.period.trim(), status: r.status.trim() as AvailabilityStatus, priceNet,
    });
  });
  return { rows, errors };
}
```

- [ ] **Step 4: Запустить — проходит**

Run: `npx vitest run tests/unit/feed.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/feed.ts tests/unit/feed.test.ts
git commit -m "feat(admin): feed record parser/validator with tests"
```

---

## Task 12: Импорт фида — API (upsert + лог)

**Files:**
- Create: `src/app/api/admin/feed-import/route.ts`
- Modify: `package.json` (dep `papaparse`, `@types/papaparse`)

**Interfaces:**
- Consumes: `parseFeedRecords`, `prisma`, `assertAdmin`.
- Produces: `POST /api/admin/feed-import` (multipart `file`: CSV или XLSX) → парсит в записи, `parseFeedRecords`, апсертит владельца→конструкцию→сторону→занятость, пишет `FeedImport`, возвращает `{ created, updated, errors }`. `created`/`updated` считаются по поверхностям.

- [ ] **Step 1: Установить papaparse**

Run: `npm i papaparse && npm i -D @types/papaparse`

- [ ] **Step 2: Реализация**

Create `src/app/api/admin/feed-import/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/admin/api-guard";
import { parseFeedRecords } from "@/lib/domain/feed";

function periodToDate(p: string) { const [y, m] = p.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)); }

async function readRecords(file: File): Promise<Record<string, string>[]> {
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    const headers = (ws.getRow(1).values as unknown[]).slice(1).map((h) => String(h ?? "").trim());
    const out: Record<string, string>[] = [];
    ws.eachRow((row, idx) => {
      if (idx === 1) return;
      const rec: Record<string, string> = {};
      headers.forEach((h, i) => { rec[h] = String((row.values as unknown[])[i + 1] ?? "").trim(); });
      out.push(rec);
    });
    return out;
  }
  const text = await file.text();
  return Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true }).data;
}

export async function POST(req: NextRequest) {
  const deny = await assertAdmin(); if (deny) return deny;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });

  const { rows, errors } = parseFeedRecords(await readRecords(file));
  let created = 0, updated = 0;

  for (const r of rows) {
    const owner = await prisma.owner.upsert({ where: { name: r.ownerName }, create: { name: r.ownerName }, update: {} });
    const construction = await prisma.construction.upsert({
      where: { /* composite lookup */ id: (await prisma.construction.findFirst({ where: { ownerId: owner.id, constructionNumber: r.constructionNumber }, select: { id: true } }))?.id ?? "___none___" },
      create: { ownerId: owner.id, constructionNumber: r.constructionNumber, ownerNumber: r.ownerNumber, type: r.type, format: r.format, district: r.district, address: r.address, lat: r.lat, lng: r.lng, lighting: r.lighting },
      update: { ownerNumber: r.ownerNumber, type: r.type, format: r.format, district: r.district, address: r.address, lat: r.lat, lng: r.lng, lighting: r.lighting },
    });
    const existing = await prisma.surface.findFirst({ where: { constructionId: construction.id, sideCode: r.sideCode }, select: { id: true } });
    const surface = existing
      ? (await prisma.surface.update({ where: { id: existing.id }, data: { direction: r.direction, surfaceNumber: r.surfaceNumber, gid: r.gid, grp: r.grp, ots: r.ots } }), existing)
      : await prisma.surface.create({ data: { constructionId: construction.id, sideCode: r.sideCode, direction: r.direction, surfaceNumber: r.surfaceNumber, gid: r.gid, grp: r.grp, ots: r.ots } });
    if (existing) updated++; else created++;
    await prisma.availability.upsert({
      where: { surfaceId_period: { surfaceId: surface.id, period: periodToDate(r.period) } },
      create: { surfaceId: surface.id, period: periodToDate(r.period), status: r.status, priceNet: r.priceNet, priceGross: r.priceNet ? Math.round(r.priceNet * 1.22) : null },
      update: { status: r.status, priceNet: r.priceNet, priceGross: r.priceNet ? Math.round(r.priceNet * 1.22) : null },
    });
  }

  await prisma.feedImport.create({ data: { fileName: file.name, createdCount: created, updatedCount: updated } });
  return NextResponse.json({ created, updated, errors });
}
```

> Примечание для реализатора: составной upsert конструкции по `(ownerId, constructionNumber)` не выражается напрямую через Prisma `upsert` без уникального индекса. Либо (а) добавить `@@unique([ownerId, constructionNumber])` в модель `Construction` и миграцию, и использовать его в `where` — предпочтительно; либо (б) оставить показанный `findFirst`→create/update паттерн. Если выбираете (а): в отдельном под-шаге добавьте индекс и миграцию `npx prisma migrate dev --name construction_owner_number_unique`, затем упростите `where` до `{ ownerId_constructionNumber: { ownerId: owner.id, constructionNumber: r.constructionNumber } }`.

- [ ] **Step 3: Проверка**

Run: подготовить маленький CSV (3-4 строки, 1 новая конструкция + 1 обновление существующей), под админом `curl -F file=@feed.csv` на эндпоинт. Проверить `{created, updated, errors}` и что данные видны у клиента и в списке конструкций.
Expected: апсерт создаёт/обновляет корректно, лог `FeedImport` пишется, ошибки строк возвращаются.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/feed-import package.json package-lock.json
git commit -m "feat(admin): feed import API (CSV/XLSX upsert + log)"
```

---

## Task 13: Импорт фида — UI

**Files:**
- Create: `src/app/admin/import/page.tsx`, `src/app/admin/import/ImportClient.tsx`

**Interfaces:**
- Consumes: `/api/admin/feed-import`, `prisma` (лог через серверную страницу).

- [ ] **Step 1: Экран импорта**

Create `src/app/admin/import/ImportClient.tsx`:
```tsx
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
```

Create `src/app/admin/import/page.tsx`:
```tsx
import { prisma } from "@/lib/db";
import { ImportClient } from "./ImportClient";

export default async function Page() {
  const log = await prisma.feedImport.findMany({ orderBy: { importedAt: "desc" }, take: 10 });
  return (
    <div>
      <ImportClient />
      <h2 className="mt-6 mb-2 text-sm font-medium">Последние импорты</h2>
      <table className="w-full text-sm">
        <thead className="bg-slate-50"><tr><th className="border-b px-2 py-1 text-left">Файл</th><th className="border-b px-2 py-1 text-left">Дата</th><th className="border-b px-2 py-1 text-left">Создано</th><th className="border-b px-2 py-1 text-left">Обновлено</th></tr></thead>
        <tbody>{log.map((l) => <tr key={l.id}><td className="border-b px-2 py-1">{l.fileName}</td><td className="border-b px-2 py-1">{l.importedAt.toISOString().slice(0, 16).replace("T", " ")}</td><td className="border-b px-2 py-1">{l.createdCount}</td><td className="border-b px-2 py-1">{l.updatedCount}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Проверка**

Run: `/admin/import` под админом → загрузить тестовый CSV → показывает created/updated/ошибки; ниже — таблица последних импортов (появилась запись).
Expected: загрузка файла и отображение результата+лога работают.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/import
git commit -m "feat(admin): feed import UI with result and history"
```

---

## Task 14: E2E админки + обновление README

**Files:**
- Create: `tests/e2e/admin.spec.ts`, `docs/screenshots/admin-dashboard.png` (снимок), маленький `docs/samples/feed-sample.csv`
- Modify: `README.md`

**Interfaces:** нет (тест + докуmethods).

- [ ] **Step 1: Пример фида**

Create `docs/samples/feed-sample.csv`:
```
ownerName,constructionNumber,ownerNumber,type,format,district,address,lat,lng,lighting,sideCode,direction,surfaceNumber,gid,grp,ots,period,status,priceNet
Демо Владелец,999001,77.1,Билборд 3х6,3х6,Невский,Тестовая ул., д.1,59.93,30.34,да,А,прямое,999001,999001А,5.0,40000,2026-07,FREE,110000
Демо Владелец,999001,77.1,Билборд 3х6,3х6,Невский,Тестовая ул., д.1,59.93,30.34,да,Б,обратное,999002,999001Б,4.0,35000,2026-07,SOLD,110000
```

- [ ] **Step 2: E2E-сценарий админки**

Create `tests/e2e/admin.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  for (let a = 0; a < 4; a++) {
    await page.goto("/login");
    await page.getByRole("button", { name: "Войти как Админ" }).click();
    try { await page.waitForURL("**/workspace", { timeout: 30000 }); return; } catch {}
  }
  throw new Error("admin login failed");
}

test("admin sees dashboard and creates an owner", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin");
  await expect(page.getByText("Дашборд")).toBeVisible();
  await expect(page.getByText("Владельцы")).toBeVisible();

  await page.goto("/admin/owners");
  const name = "E2E Владелец";
  await page.getByPlaceholder("Название*").fill(name);
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByText(name)).toBeVisible();
});

test("client is denied admin access", async ({ page }) => {
  for (let a = 0; a < 4; a++) {
    await page.goto("/login");
    await page.getByRole("button", { name: "Войти как Клиент" }).click();
    try { await page.waitForURL("**/workspace", { timeout: 30000 }); break; } catch {}
  }
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/workspace/);
});
```

> Реализатору: расширьте `tests/e2e/global-setup.ts`, чтобы также удалять владельцев/пользователей с префиксом `E2E`, иначе прогоны будут накапливать записи (как было в Плане 1 с рабочими списками).

- [ ] **Step 3: Прогнать все тесты**

Run: `npm test && npm run e2e`
Expected: unit (включая feed) — PASS; e2e (smoke клиента + admin) — PASS.

- [ ] **Step 4: README**

Обновить `README.md`: в разделе «Возможности» добавить блок **Админка** (дашборд, владельцы, клиенты+пользователи, конструкции/цены, импорт фида); добавить формат фида и путь к `docs/samples/feed-sample.csv`; добавить скриншот `docs/screenshots/admin-dashboard.png`; в «Дальнейшее развитие» отметить, что План 2 выполнен.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/admin.spec.ts tests/e2e/global-setup.ts docs/samples README.md docs/screenshots
git commit -m "test(admin): e2e admin flow + docs and feed sample"
```

---

## Self-Review (проведено при написании плана)

**Покрытие раздела 4 спеки (Админ):**
- Ролевой доступ к /admin (edge + сервер) → Task 1.
- Дашборд статистики → Task 2.
- Владельцы CRUD (API+UI) → Task 4–5.
- Клиенты и пользователи (API+UI) → Task 6–7.
- Конструкции+стороны+цены (API+UI, редактор занятости) → Task 8–10.
- Импорт фида (парсер+API+UI, лог) → Task 11–13.
- Тесты (unit feed + e2e admin) и README → Task 14.

**Заглушки:** реальный код/команды во всех шагах; заглушка `admin/page.tsx` из Task 1 заменяется в Task 2 (помечено).

**Согласованность:** `assertAdmin` (API, коды) и `requireAdmin` (страницы, редирект) — два намеренно разных хелпера; `FeedRow`/`parseFeedRecords`, `api()`, `DataTable`, upsert-паттерн по `(surfaceId, period)` через существующий составной уникальный ключ `surfaceId_period` — консистентны с Планом 1. Отмечен единственный узел, требующий решения (составной upsert конструкции — добавить `@@unique` или оставить findFirst-паттерн).

**Зависимости от Плана 1:** использует существующие `auth`, `prisma`, `periodKey`, `AvailabilityStatus`, `Availability` уникальный ключ `@@unique([surfaceId, period])`. Ничего из этого не ломается.
