# ЛК FD — Фундамент + Клиентский рабочий стол. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать работающее демо личного кабинета медиаселлера OOH: клиент входит, ищет рекламные поверхности на карте и в списке, смотрит карточку стороны с занятостью по месяцам, собирает рабочие списки и выгружает их в Excel.

**Architecture:** Монолит на Next.js 15 (App Router) — фронт и API в одном репозитории. Данные в PostgreSQL через Prisma. Бизнес-логика (агрегация занятости, фильтры, парсинг ID, экспорт) вынесена в чистые функции в `src/lib/domain` и покрыта unit-тестами. Карта абстрагирована интерфейсом `MapProvider` с реализациями Leaflet (по умолчанию) и Yandex (опционально по env-ключу). E2E-smoke на Playwright.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS + shadcn/ui, Prisma, PostgreSQL, Auth.js (NextAuth v5), TanStack Table, react-resizable-panels, react-leaflet + leaflet.markercluster, exceljs, Zod, Vitest, Playwright.

## Global Constraints

- Node.js ≥ 20, package manager: `npm`.
- Next.js 16 App Router (installed by `create-next-app@latest`; plan text says "15" — 16 is compatible with all patterns here), TypeScript strict mode.
- Prisma pinned to **6.x** (`@prisma/client@6` + `prisma@6`) so `import { PrismaClient } from "@prisma/client"` works as written; Prisma 7 changed client generation and would require different import paths.
- `react-resizable-panels` pinned to **2.x** — v4 renamed exports (`Group`/`Separator`); the plan uses the v2 `PanelGroup`/`Panel`/`PanelResizeHandle` API.
- Язык всего UI — **русский**.
- Роли: `CLIENT`, `ADMIN` (enum в Prisma). Этот план реализует только клиентские экраны, но модель и роли заводятся полностью.
- Статусы занятости (enum `AvailabilityStatus`): `FREE`, `SOLD`, `RESERVED_OTHER`, `NEEDS_CHECK`. Русские подписи: Свободно / Продано / Чужой резерв / Необходимо уточнить.
- Периоды хранятся как `DateTime`, первое число месяца, UTC полночь.
- Демо-пользователи: `client@demo` / `demo1234` (CLIENT), `admin@demo` / `demo1234` (ADMIN).
- Все команды выполняются из корня проекта `C:\Projects\заказы\демо лк FD`.
- Карта: по умолчанию Leaflet+OSM; Yandex включается только если задан `NEXT_PUBLIC_YANDEX_API_KEY`.
- Каждая задача заканчивается коммитом.

---

## File Structure

```
docker-compose.yml                 # Postgres для локальной разработки
.env / .env.example                # DATABASE_URL, AUTH_SECRET, NEXT_PUBLIC_YANDEX_API_KEY?
prisma/
  schema.prisma                    # все модели
  seed.ts                          # генерация ~200 поверхностей по СПб
src/
  lib/
    db.ts                          # singleton PrismaClient
    auth.ts                        # NextAuth конфиг, auth(), хелперы ролей
    domain/
      availability.ts              # типы статусов, агрегация статуса поверхности
      filters.ts                   # parseFilters + buildWhere
      id-paste.ts                  # парсер вставленных ID
      export.ts                    # сборка .xlsx
    map/
      provider.ts                  # тип MapMarker, getMapProvider()
      LeafletMap.tsx               # реализация на react-leaflet
      YandexMap.tsx                # реализация на Yandex JS API 3.0
      MapView.tsx                  # выбор провайдера
  app/
    layout.tsx, globals.css
    page.tsx                       # редирект на /workspace | /login
    login/page.tsx
    api/auth/[...nextauth]/route.ts
    api/surfaces/route.ts          # GET поиск по фильтрам
    api/surfaces/[id]/route.ts     # GET одна поверхность + занятость
    api/working-lists/route.ts     # GET все, POST создать
    api/working-lists/[id]/route.ts# PATCH переименовать, DELETE
    api/working-lists/[id]/items/route.ts   # POST добавить (по ids), DELETE убрать
    api/working-lists/[id]/export/route.ts  # GET xlsx
    api/error-reports/route.ts     # POST
    workspace/page.tsx             # серверная загрузка опций фильтров
    workspace/WorkspaceClient.tsx  # 3-зонная оболочка
  components/workspace/
    FilterBar.tsx
    SurfaceList.tsx
    SideCard.tsx
    AvailabilityCalendar.tsx
    WorkingListsPanel.tsx
  components/ui/                    # shadcn компоненты
tests/
  unit/*.test.ts                   # vitest
  e2e/smoke.spec.ts                # playwright
```

---

## Task 1: Скаффолд проекта, БД, инструменты

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `docker-compose.yml`, `.env.example`, `.env`, `vitest.config.ts`
- Create: `src/lib/db.ts`

**Interfaces:**
- Produces: `prisma` singleton из `src/lib/db.ts` — `export const prisma: PrismaClient`.

- [ ] **Step 1: Скаффолд Next.js**

Run:
```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```
Если каталог не пуст (есть `docs/`, `.git`, `.xlsx`) — подтвердить продолжение. Ответить на промпты значениями выше.

- [ ] **Step 2: Установить зависимости**

Run:
```bash
npm i @prisma/client next-auth@beta @auth/prisma-adapter bcryptjs zod exceljs @tanstack/react-table react-resizable-panels react-leaflet leaflet leaflet.markercluster
npm i -D prisma @types/leaflet @types/bcryptjs vitest @vitejs/plugin-react tsx @playwright/test
```

- [ ] **Step 3: docker-compose для Postgres**

Create `docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: lkfd
      POSTGRES_PASSWORD: lkfd
      POSTGRES_DB: lkfd
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

Create `.env.example`:
```
DATABASE_URL="postgresql://lkfd:lkfd@localhost:5432/lkfd?schema=public"
AUTH_SECRET="change-me-in-prod"
# NEXT_PUBLIC_YANDEX_API_KEY=""
```
Скопировать в `.env` (`cp .env.example .env`).

- [ ] **Step 4: Prisma init + db.ts**

Run: `npx prisma init --datasource-provider postgresql` (перезапишет `.env` — вернуть `DATABASE_URL` из шага 3, добавить `AUTH_SECRET`).

Create `src/lib/db.ts`:
```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 5: Vitest конфиг**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: { environment: "node", include: ["tests/unit/**/*.test.ts"] },
  resolve: { alias: { "@": resolve(__dirname, "src") } },
});
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"db:seed": "tsx prisma/seed.ts"`, `"e2e": "playwright test"`.

- [ ] **Step 6: Базовый layout (русский)**

Replace `src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Личный кабинет FD", description: "Демо ЛК медиаселлера наружной рекламы" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="ru"><body className="antialiased">{children}</body></html>);
}
```

- [ ] **Step 7: Запустить сборку**

Run: `docker compose up -d && npm run build`
Expected: `docker` поднимает Postgres; `next build` завершается без ошибок типов.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Prisma + tooling"
```

---

## Task 2: Схема Prisma и миграция

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: модели `Owner, Client, User, Construction, Surface, Availability, WorkingList, WorkingListItem, FeedImport, ErrorReport`; enums `Role { CLIENT, ADMIN }`, `AvailabilityStatus { FREE, SOLD, RESERVED_OTHER, NEEDS_CHECK }`.

- [ ] **Step 1: Написать схему**

Replace `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  CLIENT
  ADMIN
}

enum AvailabilityStatus {
  FREE
  SOLD
  RESERVED_OTHER
  NEEDS_CHECK
}

model Owner {
  id            String         @id @default(cuid())
  name          String         @unique
  site          String?
  phone         String?
  email         String?
  contactPerson String?
  constructions Construction[]
  createdAt     DateTime       @default(now())
}

model Client {
  id            String        @id @default(cuid())
  name          String        @unique
  site          String?
  phone         String?
  email         String?
  contactPerson String?
  users         User[]
  workingLists  WorkingList[]
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  passwordHash String
  role         Role     @default(CLIENT)
  client       Client?  @relation(fields: [clientId], references: [id])
  clientId     String?
  createdAt    DateTime @default(now())
}

model Construction {
  id                 String     @id @default(cuid())
  owner              Owner      @relation(fields: [ownerId], references: [id])
  ownerId            String
  constructionNumber String
  ownerNumber        String?
  type               String
  format             String
  district           String
  address            String
  lat                Float
  lng                Float
  lighting           Boolean    @default(false)
  description        String?
  panoramaUrl        String?
  surfaces           Surface[]
}

model Surface {
  id             String            @id @default(cuid())
  construction   Construction      @relation(fields: [constructionId], references: [id], onDelete: Cascade)
  constructionId String
  sideCode       String
  direction      String?
  gid            String?
  surfaceNumber  String?
  photoUrl       String?
  mapPhotoUrl    String?
  grp            Float?
  ots            Float?
  esparId        String?
  oneShowSec     Int?
  showsPerDay    Int?
  material       String?
  printType      String?
  montage        String?
  availability   Availability[]
  listItems      WorkingListItem[]
}

model Availability {
  id         String             @id @default(cuid())
  surface    Surface            @relation(fields: [surfaceId], references: [id], onDelete: Cascade)
  surfaceId  String
  period     DateTime
  status     AvailabilityStatus
  priceNet   Int?
  priceGross Int?
  @@unique([surfaceId, period])
  @@index([period, status])
}

model WorkingList {
  id        String            @id @default(cuid())
  client    Client            @relation(fields: [clientId], references: [id])
  clientId  String
  name      String
  createdAt DateTime          @default(now())
  items     WorkingListItem[]
}

model WorkingListItem {
  id        String      @id @default(cuid())
  list      WorkingList @relation(fields: [listId], references: [id], onDelete: Cascade)
  listId    String
  surface   Surface     @relation(fields: [surfaceId], references: [id], onDelete: Cascade)
  surfaceId String
  addedAt   DateTime    @default(now())
  @@unique([listId, surfaceId])
}

model FeedImport {
  id           String   @id @default(cuid())
  fileName     String
  importedAt   DateTime @default(now())
  createdCount Int
  updatedCount Int
  ownerId      String?
}

model ErrorReport {
  id        String   @id @default(cuid())
  surfaceId String
  reasons   String[]
  comment   String?
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Миграция**

Run: `npx prisma migrate dev --name init`
Expected: миграция создана и применена, клиент сгенерирован.

- [ ] **Step 3: Commit**

```bash
git add prisma
git commit -m "feat: Prisma schema and initial migration"
```

---

## Task 3: Seed-скрипт (демо-данные по СПб)

**Files:**
- Create: `prisma/seed.ts`

**Interfaces:**
- Consumes: `prisma` из `@/lib/db`, модели из Task 2.
- Produces: в БД — 9 владельцев, 4 клиента, 2 пользователя, ~100 конструкций / ~200 поверхностей с занятостью на 12 месяцев 2026.

- [ ] **Step 1: Написать seed**

Create `prisma/seed.ts`:
```ts
import { PrismaClient, AvailabilityStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const OWNERS = ["Билбордпост","Гриф","Реклама Центр","РИМ","РУСС","Перспектива","Леноблреклама","ЭЛВИС","POSTEXX"];
const CLIENTS = ["ЛЭНЖИ","ДСК","Ресторан Фокс","КАНТРИ ХАУС"];
const DISTRICTS = ["Адмиралтейский","Василеостровский","Всеволожский","Выборгский","Калининский","Кировский","Красногвардейский","Красносельский","Московский","Невский","Петроградский","Приморский","Пушкинский","Фрунзенский","Центральный"];
const TYPES = ["Билборд 3х6","Ситиборд","Суперсайт","Цифровой экран","Пиллар","Ситиформат"];
const FORMATS = ["3х6","5х12","5х15","2,7х3,7","1,2х1,8","1,4х3"];
const STATUSES: AvailabilityStatus[] = ["FREE","SOLD","RESERVED_OTHER","NEEDS_CHECK"];

// СПб bbox примерно
const LAT = [59.8, 60.09];
const LNG = [30.15, 30.55];
function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }

async function main() {
  await prisma.workingListItem.deleteMany();
  await prisma.workingList.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.surface.deleteMany();
  await prisma.construction.deleteMany();
  await prisma.user.deleteMany();
  await prisma.client.deleteMany();
  await prisma.owner.deleteMany();

  const owners = await Promise.all(OWNERS.map((name, i) =>
    prisma.owner.create({ data: { name, site: `https://owner-${i}.example.com`, email: `sales@owner-${i}.example.com` } })));
  const clients = await Promise.all(CLIENTS.map((name) => prisma.client.create({ data: { name } })));

  const hash = await bcrypt.hash("demo1234", 10);
  await prisma.user.create({ data: { email: "client@demo", name: "Демо Клиент", passwordHash: hash, role: "CLIENT", clientId: clients[0].id } });
  await prisma.user.create({ data: { email: "admin@demo", name: "Демо Админ", passwordHash: hash, role: "ADMIN" } });

  const periods = Array.from({ length: 12 }, (_, m) => new Date(Date.UTC(2026, m, 1)));

  let cNum = 300000;
  for (let i = 0; i < 100; i++) {
    const owner = pick(owners);
    const isDigital = Math.random() < 0.2;
    const construction = await prisma.construction.create({
      data: {
        ownerId: owner.id,
        constructionNumber: String(cNum++),
        ownerNumber: `${(30 + Math.random() * 5).toFixed(1)}`,
        type: isDigital ? "Цифровой экран" : pick(TYPES),
        format: isDigital ? "5х12" : pick(FORMATS),
        district: pick(DISTRICTS),
        address: `${pick(["Шувалова ул.","Ленина пр-т.","Выборгское ш.","Дорога Жизни а/д","Московский пр-т."])}, д.${1 + Math.floor(Math.random() * 200)}`,
        lat: rand(LAT[0], LAT[1]),
        lng: rand(LNG[0], LNG[1]),
        lighting: Math.random() < 0.7,
        description: "Центральный перекрёсток, высокий трафик.",
      },
    });
    const sides = ["А", "Б"];
    for (const side of sides) {
      const surface = await prisma.surface.create({
        data: {
          constructionId: construction.id,
          sideCode: side,
          direction: side === "А" ? "прямое" : "обратное",
          gid: `${construction.constructionNumber}${side}`,
          surfaceNumber: `${776000 + i * 2 + (side === "А" ? 0 : 1)}`,
          grp: Math.round(rand(2, 20) * 10) / 10,
          ots: Math.round(rand(10000, 90000)),
          oneShowSec: isDigital ? 5 : null,
          showsPerDay: isDigital ? pick([8640, 5760]) : null,
        },
      });
      await prisma.availability.createMany({
        data: periods.map((period) => {
          const status = pick(STATUSES);
          const base = isDigital ? 300000 : 100000 + Math.floor(Math.random() * 60000);
          return { surfaceId: surface.id, period, status, priceNet: base, priceGross: Math.round(base * 1.22) };
        }),
      });
    }
  }
  console.log("Seed complete");
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Запустить seed**

Run: `npm run db:seed`
Expected: вывод `Seed complete`, без ошибок.

- [ ] **Step 3: Проверить количество**

Run: `npx prisma studio` (визуально) или
```bash
npx tsx -e "import {prisma} from './src/lib/db'; prisma.surface.count().then(n=>{console.log('surfaces',n);process.exit(0)})"
```
Expected: `surfaces 200`.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: seed script with ~200 SPb surfaces"
```

---

## Task 4: Доменная логика — статусы занятости (TDD)

**Files:**
- Create: `src/lib/domain/availability.ts`
- Test: `tests/unit/availability.test.ts`

**Interfaces:**
- Produces:
  - `type AvailabilityStatus = "FREE" | "SOLD" | "RESERVED_OTHER" | "NEEDS_CHECK"`
  - `const STATUS_LABELS: Record<AvailabilityStatus, string>`
  - `const STATUS_COLORS: Record<AvailabilityStatus, string>` (hex для маркеров/легенды)
  - `interface MonthAvailability { period: string; status: AvailabilityStatus; priceNet: number | null; priceGross: number | null }`
  - `function aggregateStatus(months: MonthAvailability[], selectedPeriods: string[]): AvailabilityStatus` — статус поверхности для маркера: если среди выбранных периодов есть хоть один `FREE` → `FREE`; иначе если все `SOLD` → `SOLD`; иначе если есть `NEEDS_CHECK` → `NEEDS_CHECK`; иначе `RESERVED_OTHER`. Если `selectedPeriods` пуст — учитывать все месяцы.

- [ ] **Step 1: Написать падающий тест**

Create `tests/unit/availability.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { aggregateStatus, type MonthAvailability } from "@/lib/domain/availability";

const m = (period: string, status: MonthAvailability["status"]): MonthAvailability =>
  ({ period, status, priceNet: null, priceGross: null });

describe("aggregateStatus", () => {
  it("returns FREE if any selected month is free", () => {
    const months = [m("2026-01", "SOLD"), m("2026-02", "FREE")];
    expect(aggregateStatus(months, ["2026-01", "2026-02"])).toBe("FREE");
  });
  it("returns SOLD if all selected months are sold", () => {
    const months = [m("2026-01", "SOLD"), m("2026-02", "SOLD")];
    expect(aggregateStatus(months, ["2026-01", "2026-02"])).toBe("SOLD");
  });
  it("respects selected periods only", () => {
    const months = [m("2026-01", "FREE"), m("2026-02", "SOLD")];
    expect(aggregateStatus(months, ["2026-02"])).toBe("SOLD");
  });
  it("uses all months when selection empty", () => {
    const months = [m("2026-01", "SOLD"), m("2026-02", "FREE")];
    expect(aggregateStatus(months, [])).toBe("FREE");
  });
  it("returns NEEDS_CHECK over RESERVED_OTHER when no free/sold-all", () => {
    const months = [m("2026-01", "RESERVED_OTHER"), m("2026-02", "NEEDS_CHECK")];
    expect(aggregateStatus(months, [])).toBe("NEEDS_CHECK");
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npx vitest run tests/unit/availability.test.ts`
Expected: FAIL (`Cannot find module '@/lib/domain/availability'`).

- [ ] **Step 3: Реализация**

Create `src/lib/domain/availability.ts`:
```ts
export type AvailabilityStatus = "FREE" | "SOLD" | "RESERVED_OTHER" | "NEEDS_CHECK";

export const STATUS_LABELS: Record<AvailabilityStatus, string> = {
  FREE: "Свободно",
  SOLD: "Продано",
  RESERVED_OTHER: "Чужой резерв",
  NEEDS_CHECK: "Необходимо уточнить",
};

export const STATUS_COLORS: Record<AvailabilityStatus, string> = {
  FREE: "#16a34a",
  SOLD: "#dc2626",
  RESERVED_OTHER: "#f59e0b",
  NEEDS_CHECK: "#6b7280",
};

export interface MonthAvailability {
  period: string;
  status: AvailabilityStatus;
  priceNet: number | null;
  priceGross: number | null;
}

export function aggregateStatus(months: MonthAvailability[], selectedPeriods: string[]): AvailabilityStatus {
  const scope = selectedPeriods.length ? months.filter((x) => selectedPeriods.includes(x.period)) : months;
  if (scope.length === 0) return "NEEDS_CHECK";
  if (scope.some((x) => x.status === "FREE")) return "FREE";
  if (scope.every((x) => x.status === "SOLD")) return "SOLD";
  if (scope.some((x) => x.status === "NEEDS_CHECK")) return "NEEDS_CHECK";
  return "RESERVED_OTHER";
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `npx vitest run tests/unit/availability.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/availability.ts tests/unit/availability.test.ts
git commit -m "feat: availability status aggregation with tests"
```

---

## Task 5: Доменная логика — парсер вставленных ID (TDD)

**Files:**
- Create: `src/lib/domain/id-paste.ts`
- Test: `tests/unit/id-paste.test.ts`

**Interfaces:**
- Produces: `function parsePastedIds(raw: string, cap?: number): string[]` — разбивает по пробелам/запятым/переводам строк/точкам-с-запятой, тримит, отбрасывает пустые, дедуплицирует с сохранением порядка, ограничивает `cap` (по умолчанию 500).

- [ ] **Step 1: Падающий тест**

Create `tests/unit/id-paste.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parsePastedIds } from "@/lib/domain/id-paste";

describe("parsePastedIds", () => {
  it("splits on spaces, commas, newlines, semicolons", () => {
    expect(parsePastedIds("629094 992123,961000\n166299;123")).toEqual(["629094","992123","961000","166299","123"]);
  });
  it("dedupes preserving order", () => {
    expect(parsePastedIds("10 10 20 10")).toEqual(["10","20"]);
  });
  it("caps to limit", () => {
    const raw = Array.from({length: 600}, (_,i)=>String(i)).join(" ");
    expect(parsePastedIds(raw).length).toBe(500);
  });
  it("returns empty for blank", () => {
    expect(parsePastedIds("   \n ")).toEqual([]);
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run tests/unit/id-paste.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Реализация**

Create `src/lib/domain/id-paste.ts`:
```ts
export function parsePastedIds(raw: string, cap = 500): string[] {
  const tokens = raw.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (!seen.has(t)) { seen.add(t); out.push(t); }
    if (out.length >= cap) break;
  }
  return out;
}
```

- [ ] **Step 4: Запустить — проходит**

Run: `npx vitest run tests/unit/id-paste.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/id-paste.ts tests/unit/id-paste.test.ts
git commit -m "feat: pasted-id parser with tests"
```

---

## Task 6: Доменная логика — фильтры (TDD)

**Files:**
- Create: `src/lib/domain/filters.ts`
- Test: `tests/unit/filters.test.ts`

**Interfaces:**
- Consumes: `AvailabilityStatus` из `@/lib/domain/availability`.
- Produces:
  - `interface SurfaceFilters { ownerIds: string[]; districts: string[]; formats: string[]; types: string[]; sides: string[]; periods: string[]; statuses: AvailabilityStatus[]; q: string | null }`
  - `function parseFilters(sp: URLSearchParams): SurfaceFilters` — читает повторяющиеся ключи `owner, district, format, type, side, period, status` и одиночный `q`.
  - `function buildSurfaceWhere(f: SurfaceFilters): object` — возвращает Prisma `where` для `Surface` (фильтр по полям конструкции через `construction: {...}`, по `sideCode`, и по занятости через `availability: { some: { period in, status in } }`; текстовый `q` — по адресу/номеру конструкции/поверхности).

- [ ] **Step 1: Падающий тест**

Create `tests/unit/filters.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseFilters, buildSurfaceWhere } from "@/lib/domain/filters";

describe("parseFilters", () => {
  it("reads repeated and single params", () => {
    const sp = new URLSearchParams("owner=o1&owner=o2&district=Невский&status=FREE&period=2026-07&q=Ленина");
    const f = parseFilters(sp);
    expect(f.ownerIds).toEqual(["o1","o2"]);
    expect(f.districts).toEqual(["Невский"]);
    expect(f.statuses).toEqual(["FREE"]);
    expect(f.periods).toEqual(["2026-07"]);
    expect(f.q).toBe("Ленина");
  });
});

describe("buildSurfaceWhere", () => {
  it("maps owners/districts to construction relation", () => {
    const where: any = buildSurfaceWhere(parseFilters(new URLSearchParams("owner=o1&district=Невский")));
    expect(where.construction.ownerId.in).toEqual(["o1"]);
    expect(where.construction.district.in).toEqual(["Невский"]);
  });
  it("maps status+period to availability.some", () => {
    const where: any = buildSurfaceWhere(parseFilters(new URLSearchParams("status=FREE&period=2026-07")));
    expect(where.availability.some.status.in).toEqual(["FREE"]);
    expect(where.availability.some.period.in[0]).toBeInstanceOf(Date);
  });
  it("omits empty facets", () => {
    const where: any = buildSurfaceWhere(parseFilters(new URLSearchParams("")));
    expect(where.construction).toBeUndefined();
    expect(where.availability).toBeUndefined();
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run tests/unit/filters.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Реализация**

Create `src/lib/domain/filters.ts`:
```ts
import type { AvailabilityStatus } from "./availability";

export interface SurfaceFilters {
  ownerIds: string[];
  districts: string[];
  formats: string[];
  types: string[];
  sides: string[];
  periods: string[]; // "YYYY-MM"
  statuses: AvailabilityStatus[];
  q: string | null;
}

const VALID_STATUS = new Set(["FREE","SOLD","RESERVED_OTHER","NEEDS_CHECK"]);

export function parseFilters(sp: URLSearchParams): SurfaceFilters {
  const all = (k: string) => sp.getAll(k).filter(Boolean);
  return {
    ownerIds: all("owner"),
    districts: all("district"),
    formats: all("format"),
    types: all("type"),
    sides: all("side"),
    periods: all("period"),
    statuses: all("status").filter((s) => VALID_STATUS.has(s)) as AvailabilityStatus[],
    q: sp.get("q")?.trim() || null,
  };
}

function periodToDate(p: string): Date {
  const [y, m] = p.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export function buildSurfaceWhere(f: SurfaceFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  const construction: Record<string, unknown> = {};
  if (f.ownerIds.length) construction.ownerId = { in: f.ownerIds };
  if (f.districts.length) construction.district = { in: f.districts };
  if (f.formats.length) construction.format = { in: f.formats };
  if (f.types.length) construction.type = { in: f.types };
  if (Object.keys(construction).length) where.construction = construction;

  if (f.sides.length) where.sideCode = { in: f.sides };

  const avail: Record<string, unknown> = {};
  if (f.periods.length) avail.period = { in: f.periods.map(periodToDate) };
  if (f.statuses.length) avail.status = { in: f.statuses };
  if (Object.keys(avail).length) where.availability = { some: avail };

  if (f.q) {
    where.OR = [
      { construction: { address: { contains: f.q, mode: "insensitive" } } },
      { construction: { constructionNumber: { contains: f.q } } },
      { surfaceNumber: { contains: f.q } },
      { gid: { contains: f.q } },
    ];
  }
  return where;
}
```

- [ ] **Step 4: Запустить — проходит**

Run: `npx vitest run tests/unit/filters.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/filters.ts tests/unit/filters.test.ts
git commit -m "feat: filter parsing and Prisma where builder with tests"
```

---

## Task 7: Доменная логика — экспорт в Excel (TDD)

**Files:**
- Create: `src/lib/domain/export.ts`
- Test: `tests/unit/export.test.ts`

**Interfaces:**
- Produces:
  - `interface ExportRow { num: number; surfaceNumber: string; ownerNumber: string; owner: string; type: string; format: string; district: string; address: string; side: string; light: string; grp: string; ots: string; period: string }`
  - `const EXPORT_COLUMNS: { key: keyof ExportRow; header: string }[]`
  - `async function buildWorkbook(rows: ExportRow[], columnKeys: (keyof ExportRow)[]): Promise<Buffer>` — строит .xlsx только с выбранными колонками; первая строка — заголовки.

- [ ] **Step 1: Падающий тест**

Create `tests/unit/export.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildWorkbook, EXPORT_COLUMNS, type ExportRow } from "@/lib/domain/export";

const row: ExportRow = { num: 1, surfaceNumber: "776262", ownerNumber: "30.8", owner: "ЭЛВИС", type: "Билборд 3х6", format: "3х6", district: "Невский", address: "Ленина пр-т., д.10", side: "А", light: "есть", grp: "3.2", ots: "45000", period: "июль 2026" };

describe("buildWorkbook", () => {
  it("includes only selected columns in order", async () => {
    const buf = await buildWorkbook([row], ["num","address","owner"]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const ws = wb.worksheets[0];
    expect(ws.getRow(1).values).toEqual([undefined, "№", "Адрес", "Владелец"]);
    expect(ws.getRow(2).getCell(2).value).toBe("Ленина пр-т., д.10");
  });
  it("EXPORT_COLUMNS covers every ExportRow key", () => {
    const keys = Object.keys(row) as (keyof ExportRow)[];
    expect(EXPORT_COLUMNS.map((c) => c.key).sort()).toEqual(keys.sort());
  });
});
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run tests/unit/export.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Реализация**

Create `src/lib/domain/export.ts`:
```ts
import ExcelJS from "exceljs";

export interface ExportRow {
  num: number;
  surfaceNumber: string;
  ownerNumber: string;
  owner: string;
  type: string;
  format: string;
  district: string;
  address: string;
  side: string;
  light: string;
  grp: string;
  ots: string;
  period: string;
}

export const EXPORT_COLUMNS: { key: keyof ExportRow; header: string }[] = [
  { key: "num", header: "№" },
  { key: "surfaceNumber", header: "№ Пов-ти" },
  { key: "ownerNumber", header: "№ Влад-ца" },
  { key: "owner", header: "Владелец" },
  { key: "type", header: "Тип" },
  { key: "format", header: "Формат" },
  { key: "district", header: "Район" },
  { key: "address", header: "Адрес" },
  { key: "side", header: "Сторона" },
  { key: "light", header: "Свет" },
  { key: "grp", header: "GRP" },
  { key: "ots", header: "OTS" },
  { key: "period", header: "Период" },
];

export async function buildWorkbook(rows: ExportRow[], columnKeys: (keyof ExportRow)[]): Promise<Buffer> {
  const cols = EXPORT_COLUMNS.filter((c) => columnKeys.includes(c.key));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Рабочий список");
  ws.addRow(cols.map((c) => c.header));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(cols.map((c) => r[c.key]));
  cols.forEach((_, i) => { ws.getColumn(i + 1).width = 18; });
  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr);
}
```

- [ ] **Step 4: Запустить — проходит**

Run: `npx vitest run tests/unit/export.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/export.ts tests/unit/export.test.ts
git commit -m "feat: xlsx export builder with tests"
```

---

## Task 8: Авторизация (Auth.js)

**Files:**
- Create: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts`, `src/types/next-auth.d.ts`

**Interfaces:**
- Consumes: `prisma` из `@/lib/db`.
- Produces: `export const { handlers, auth, signIn, signOut }` из `@/lib/auth`; сессия содержит `user.id`, `user.role`, `user.clientId`.

- [ ] **Step 1: Конфиг Auth.js**

Create `src/lib/auth.ts`:
```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? "");
        const password = String(creds?.password ?? "");
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role, clientId: user.clientId ?? undefined };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) { token.role = (user as any).role; token.clientId = (user as any).clientId; token.uid = (user as any).id; }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as string;
      session.user.clientId = token.clientId as string | undefined;
      return session;
    },
  },
  pages: { signIn: "/login" },
});
```

Create `src/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

Create `src/types/next-auth.d.ts`:
```ts
import "next-auth";
declare module "next-auth" {
  interface Session { user: { id: string; role: string; clientId?: string } & { name?: string | null; email?: string | null } }
}
```

- [ ] **Step 2: Middleware защиты**

Create `src/middleware.ts`:
```ts
import { auth } from "@/lib/auth";

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isProtected = path.startsWith("/workspace") || path.startsWith("/admin");
  if (isProtected && !req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    return Response.redirect(url);
  }
});

export const config = { matcher: ["/workspace/:path*", "/admin/:path*"] };
```

- [ ] **Step 3: Проверка сборки**

Run: `npm run build`
Expected: без ошибок типов (сессия расширена в `next-auth.d.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth src/middleware.ts src/types
git commit -m "feat: credentials auth with roles and route protection"
```

---

## Task 9: Страница входа с демо-кредами

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/login/LoginForm.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `signIn` (server action через `@/lib/auth`).

- [ ] **Step 1: Редирект с корня**

Replace `src/app/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  redirect(session ? "/workspace" : "/login");
}
```

- [ ] **Step 2: Форма входа**

Create `src/app/login/LoginForm.tsx`:
```tsx
"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: string, p: string) {
    setError(null);
    const res = await signIn("credentials", { email: e, password: p, redirect: false });
    if (res?.error) setError("Неверный логин или пароль");
    else router.push("/workspace");
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Личный кабинет FD</h1>
      <form onSubmit={(ev) => { ev.preventDefault(); submit(email, password); }} className="space-y-3">
        <input className="w-full rounded-md border px-3 py-2" placeholder="Логин" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded-md border px-3 py-2" placeholder="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded-md bg-slate-900 px-3 py-2 text-white">Войти</button>
      </form>
      <div className="flex gap-2">
        <button onClick={() => submit("client@demo", "demo1234")} className="flex-1 rounded-md border px-3 py-2 text-sm">Войти как Клиент</button>
        <button onClick={() => submit("admin@demo", "demo1234")} className="flex-1 rounded-md border px-3 py-2 text-sm">Войти как Админ</button>
      </div>
    </div>
  );
}
```

Create `src/app/login/page.tsx`:
```tsx
import { LoginForm } from "./LoginForm";
export default function LoginPage() {
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><LoginForm /></main>;
}
```

- [ ] **Step 3: Обернуть приложение в SessionProvider**

Create `src/app/providers.tsx`:
```tsx
"use client";
import { SessionProvider } from "next-auth/react";
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```
Modify `src/app/layout.tsx` — обернуть `{children}` в `<Providers>`.

- [ ] **Step 4: Ручная проверка**

Run: `npm run dev`, открыть `http://localhost:3000` → редирект на `/login`, кнопка «Войти как Клиент» пускает на `/workspace` (пока 404/пусто — норм).
Expected: вход работает, при неверных кредах — сообщение об ошибке.

- [ ] **Step 5: Commit**

```bash
git add src/app/login src/app/page.tsx src/app/providers.tsx src/app/layout.tsx
git commit -m "feat: login page with one-click demo credentials"
```

---

## Task 10: API поиска поверхностей

**Files:**
- Create: `src/app/api/surfaces/route.ts`, `src/app/api/surfaces/[id]/route.ts`
- Create: `src/lib/serialize.ts`

**Interfaces:**
- Consumes: `prisma`, `parseFilters`, `buildSurfaceWhere`, `aggregateStatus`, `AvailabilityStatus`.
- Produces:
  - `GET /api/surfaces?…filters…` → `{ surfaces: SurfaceListDTO[] }`, где `SurfaceListDTO = { id, lat, lng, address, district, format, type, ownerName, sideCode, status: AvailabilityStatus }` (status = `aggregateStatus` по выбранным периодам, лимит 500).
  - `GET /api/surfaces/[id]` → `SurfaceDetailDTO` (все поля поверхности+конструкции + `months: MonthAvailability[]`).
  - `src/lib/serialize.ts`: `function periodKey(d: Date): string` → `"YYYY-MM"`.

- [ ] **Step 1: Хелпер сериализации периода**

Create `src/lib/serialize.ts`:
```ts
export function periodKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
```

- [ ] **Step 2: GET /api/surfaces**

Create `src/app/api/surfaces/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseFilters, buildSurfaceWhere } from "@/lib/domain/filters";
import { aggregateStatus, type MonthAvailability } from "@/lib/domain/availability";
import { periodKey } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  const filters = parseFilters(req.nextUrl.searchParams);
  const where = buildSurfaceWhere(filters);
  const rows = await prisma.surface.findMany({
    where,
    take: 500,
    include: { construction: { include: { owner: true } }, availability: true },
  });
  const surfaces = rows.map((s) => {
    const months: MonthAvailability[] = s.availability.map((a) => ({
      period: periodKey(a.period), status: a.status, priceNet: a.priceNet, priceGross: a.priceGross,
    }));
    return {
      id: s.id, lat: s.construction.lat, lng: s.construction.lng,
      address: s.construction.address, district: s.construction.district,
      format: s.construction.format, type: s.construction.type,
      ownerName: s.construction.owner.name, sideCode: s.sideCode,
      status: aggregateStatus(months, filters.periods),
    };
  });
  return NextResponse.json({ surfaces });
}
```

- [ ] **Step 3: GET /api/surfaces/[id]**

Create `src/app/api/surfaces/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { periodKey } from "@/lib/serialize";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await prisma.surface.findUnique({
    where: { id },
    include: { construction: { include: { owner: true } }, availability: { orderBy: { period: "asc" } } },
  });
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    id: s.id, sideCode: s.sideCode, direction: s.direction, gid: s.gid, surfaceNumber: s.surfaceNumber,
    grp: s.grp, ots: s.ots, oneShowSec: s.oneShowSec, showsPerDay: s.showsPerDay,
    construction: {
      constructionNumber: s.construction.constructionNumber, ownerNumber: s.construction.ownerNumber,
      ownerName: s.construction.owner.name, ownerSite: s.construction.owner.site,
      type: s.construction.type, format: s.construction.format, district: s.construction.district,
      address: s.construction.address, lat: s.construction.lat, lng: s.construction.lng,
      lighting: s.construction.lighting, description: s.construction.description, panoramaUrl: s.construction.panoramaUrl,
    },
    months: s.availability.map((a) => ({ period: periodKey(a.period), status: a.status, priceNet: a.priceNet, priceGross: a.priceGross })),
  });
}
```

- [ ] **Step 4: Проверка запроса**

Run: `npm run dev`, затем
```bash
curl -s "http://localhost:3000/api/surfaces?district=Невский" | head -c 300
```
Expected: JSON с массивом `surfaces` (может быть пустым, если в районе нет — попробовать без фильтра).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/surfaces src/lib/serialize.ts
git commit -m "feat: surfaces search and detail API"
```

---

## Task 11: API рабочих списков (CRUD + позиции + экспорт)

**Files:**
- Create: `src/app/api/working-lists/route.ts`, `src/app/api/working-lists/[id]/route.ts`, `src/app/api/working-lists/[id]/items/route.ts`, `src/app/api/working-lists/[id]/export/route.ts`
- Create: `src/lib/session.ts`

**Interfaces:**
- Consumes: `auth`, `prisma`, `parsePastedIds`, `buildWorkbook`, `EXPORT_COLUMNS`, `periodKey`.
- Produces:
  - `src/lib/session.ts`: `async function requireClient(): Promise<{ userId: string; clientId: string }>` — бросает `Response`-совместимую ошибку через возврат `null`; хелпер возвращает `clientId` из сессии.
  - `GET /api/working-lists` → `{ lists: { id, name, count }[] }`
  - `POST /api/working-lists` `{ name }` → `{ id }`
  - `PATCH /api/working-lists/[id]` `{ name }` → `{ ok: true }`
  - `DELETE /api/working-lists/[id]` → `{ ok: true }`
  - `GET /api/working-lists/[id]` → `{ id, name, items: SurfaceListDTO[] }`
  - `POST /api/working-lists/[id]/items` `{ ids?: string[], raw?: string }` → `{ added: number }` (ids трактуются как `surfaceNumber` ИЛИ `id`)
  - `DELETE /api/working-lists/[id]/items` `{ surfaceId }` → `{ ok: true }`
  - `GET /api/working-lists/[id]/export?cols=a,b,c` → xlsx-файл.

- [ ] **Step 1: Хелпер сессии**

Create `src/lib/session.ts`:
```ts
import { auth } from "@/lib/auth";

export async function getClientId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.clientId ?? null;
}
```

- [ ] **Step 2: Коллекция списков**

Create `src/app/api/working-lists/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/session";

export async function GET() {
  const clientId = await getClientId();
  if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const lists = await prisma.workingList.findMany({
    where: { clientId }, orderBy: { createdAt: "asc" }, include: { _count: { select: { items: true } } },
  });
  return NextResponse.json({ lists: lists.map((l) => ({ id: l.id, name: l.name, count: l._count.items })) });
}

export async function POST(req: NextRequest) {
  const clientId = await getClientId();
  if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = z.object({ name: z.string().min(1).max(100) }).parse(await req.json());
  const list = await prisma.workingList.create({ data: { clientId, name: body.name } });
  return NextResponse.json({ id: list.id });
}
```

- [ ] **Step 3: Элемент списка (rename/delete/get)**

Create `src/app/api/working-lists/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/session";
import { aggregateStatus, type MonthAvailability } from "@/lib/domain/availability";
import { periodKey } from "@/lib/serialize";

async function owned(id: string, clientId: string) {
  return prisma.workingList.findFirst({ where: { id, clientId } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(); if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const list = await prisma.workingList.findFirst({
    where: { id, clientId },
    include: { items: { include: { surface: { include: { construction: { include: { owner: true } }, availability: true } } } } },
  });
  if (!list) return NextResponse.json({ error: "not found" }, { status: 404 });
  const items = list.items.map((it) => {
    const s = it.surface;
    const months: MonthAvailability[] = s.availability.map((a) => ({ period: periodKey(a.period), status: a.status, priceNet: a.priceNet, priceGross: a.priceGross }));
    return { id: s.id, lat: s.construction.lat, lng: s.construction.lng, address: s.construction.address, district: s.construction.district, format: s.construction.format, type: s.construction.type, ownerName: s.construction.owner.name, sideCode: s.sideCode, status: aggregateStatus(months, []) };
  });
  return NextResponse.json({ id: list.id, name: list.name, items });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(); if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await owned(id, clientId))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = z.object({ name: z.string().min(1).max(100) }).parse(await req.json());
  await prisma.workingList.update({ where: { id }, data: { name: body.name } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(); if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await owned(id, clientId))) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.workingList.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Позиции (добавить по ID / удалить)**

Create `src/app/api/working-lists/[id]/items/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/session";
import { parsePastedIds } from "@/lib/domain/id-paste";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(); if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const list = await prisma.workingList.findFirst({ where: { id, clientId } });
  if (!list) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = z.object({ ids: z.array(z.string()).optional(), raw: z.string().optional() }).parse(await req.json());
  const tokens = body.ids ?? parsePastedIds(body.raw ?? "");
  const surfaces = await prisma.surface.findMany({ where: { OR: [{ id: { in: tokens } }, { surfaceNumber: { in: tokens } }] }, select: { id: true } });
  if (surfaces.length === 0) return NextResponse.json({ added: 0 });
  const res = await prisma.workingListItem.createMany({
    data: surfaces.map((s) => ({ listId: id, surfaceId: s.id })), skipDuplicates: true,
  });
  return NextResponse.json({ added: res.count });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(); if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const list = await prisma.workingList.findFirst({ where: { id, clientId } });
  if (!list) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = z.object({ surfaceId: z.string() }).parse(await req.json());
  await prisma.workingListItem.deleteMany({ where: { listId: id, surfaceId: body.surfaceId } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Экспорт в Excel**

Create `src/app/api/working-lists/[id]/export/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/session";
import { buildWorkbook, EXPORT_COLUMNS, type ExportRow } from "@/lib/domain/export";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(); if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const list = await prisma.workingList.findFirst({
    where: { id, clientId },
    include: { items: { include: { surface: { include: { construction: { include: { owner: true } } } } } } },
  });
  if (!list) return NextResponse.json({ error: "not found" }, { status: 404 });

  const requested = req.nextUrl.searchParams.get("cols");
  const cols = (requested ? requested.split(",") : EXPORT_COLUMNS.map((c) => c.key)) as (keyof ExportRow)[];

  const rows: ExportRow[] = list.items.map((it, i) => {
    const s = it.surface, c = s.construction;
    return { num: i + 1, surfaceNumber: s.surfaceNumber ?? "", ownerNumber: c.ownerNumber ?? "", owner: c.owner.name, type: c.type, format: c.format, district: c.district, address: c.address, side: s.sideCode, light: c.lighting ? "есть" : "нет", grp: s.grp?.toString() ?? "", ots: s.ots?.toString() ?? "", period: "2026" };
  });
  const buf = await buildWorkbook(rows, cols);
  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="working-list-${id}.xlsx"`,
    },
  });
}
```

- [ ] **Step 6: Проверка вручную**

Run: `npm run dev`; авторизоваться как клиент в браузере; через DevTools или `curl` с cookie создать список, добавить `776262`, скачать экспорт.
Expected: создаётся список, добавляется ≥1 позиция, скачивается валидный `.xlsx`.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/working-lists src/lib/session.ts
git commit -m "feat: working lists CRUD, items and xlsx export API"
```

---

## Task 12: API отчётов об ошибках

**Files:**
- Create: `src/app/api/error-reports/route.ts`

**Interfaces:**
- Consumes: `prisma`, `getClientId`.
- Produces: `POST /api/error-reports` `{ surfaceId, reasons: string[], comment? }` → `{ ok: true }`.

- [ ] **Step 1: Реализация**

Create `src/app/api/error-reports/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const clientId = await getClientId(); if (!clientId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = z.object({ surfaceId: z.string(), reasons: z.array(z.string()), comment: z.string().max(2000).optional() }).parse(await req.json());
  await prisma.errorReport.create({ data: { surfaceId: body.surfaceId, reasons: body.reasons, comment: body.comment } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Проверка**

Run: `npm run build`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/error-reports
git commit -m "feat: error report API"
```

---

## Task 13: Слой карты — тип маркера + Leaflet-провайдер

**Files:**
- Create: `src/lib/map/provider.ts`, `src/lib/map/LeafletMap.tsx`, `src/lib/map/MapView.tsx`
- Modify: `src/app/globals.css` (импорт стилей leaflet)

**Interfaces:**
- Consumes: `AvailabilityStatus`, `STATUS_COLORS`.
- Produces:
  - `interface MapMarker { id: string; lat: number; lng: number; status: AvailabilityStatus; label: string }`
  - `interface MapViewProps { markers: MapMarker[]; selectedId: string | null; onSelect: (id: string) => void }`
  - `function getMapProvider(): "yandex" | "leaflet"` — `"yandex"` только если `process.env.NEXT_PUBLIC_YANDEX_API_KEY`.
  - `<MapView />` — клиентский компонент, рендерит нужный провайдер (Leaflet сейчас, Yandex — Task 14).

- [ ] **Step 1: Провайдер-контракт**

Create `src/lib/map/provider.ts`:
```ts
import type { AvailabilityStatus } from "@/lib/domain/availability";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  status: AvailabilityStatus;
  label: string;
}

export interface MapViewProps {
  markers: MapMarker[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function getMapProvider(): "yandex" | "leaflet" {
  return process.env.NEXT_PUBLIC_YANDEX_API_KEY ? "yandex" : "leaflet";
}
```

- [ ] **Step 2: Leaflet-карта**

Add to `src/app/globals.css` (в начало):
```css
@import "leaflet/dist/leaflet.css";
@import "leaflet.markercluster/dist/MarkerCluster.css";
@import "leaflet.markercluster/dist/MarkerCluster.Default.css";
```

Create `src/lib/map/LeafletMap.tsx`:
```tsx
"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { STATUS_COLORS } from "@/lib/domain/availability";
import type { MapViewProps } from "./provider";

const SPB: [number, number] = [59.94, 30.35];

function dotIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 2px rgba(0,0,0,.5)"></span>`,
    iconSize: [14, 14],
  });
}

export default function LeafletMap({ markers, onSelect }: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<any>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current).setView(SPB, 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);
    clusterRef.current = (L as any).markerClusterGroup();
    map.addLayer(clusterRef.current);
    mapRef.current = map;
  }, []);

  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();
    for (const m of markers) {
      const marker = L.marker([m.lat, m.lng], { icon: dotIcon(STATUS_COLORS[m.status]) });
      marker.bindTooltip(m.label);
      marker.on("click", () => onSelect(m.id));
      cluster.addLayer(marker);
    }
  }, [markers, onSelect]);

  return <div ref={ref} className="h-full w-full" />;
}
```

- [ ] **Step 3: MapView-обёртка (dynamic import, без SSR)**

Create `src/lib/map/MapView.tsx`:
```tsx
"use client";
import dynamic from "next/dynamic";
import type { MapViewProps } from "./provider";

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });

export function MapView(props: MapViewProps) {
  return <LeafletMap {...props} />;
}
```

- [ ] **Step 4: Проверка сборки**

Run: `npm run build`
Expected: без ошибок (leaflet грузится только на клиенте).

- [ ] **Step 5: Commit**

```bash
git add src/lib/map src/app/globals.css
git commit -m "feat: map provider contract and Leaflet/OSM implementation"
```

---

## Task 14: Слой карты — Yandex-провайдер (опционально по ключу)

**Files:**
- Create: `src/lib/map/YandexMap.tsx`
- Modify: `src/lib/map/MapView.tsx`

**Interfaces:**
- Consumes: `MapViewProps`, `STATUS_COLORS`, `getMapProvider`.
- Produces: `<YandexMap />` — грузит `https://api-maps.yandex.ru/v3/?apikey=...&lang=ru_RU`, рисует маркеры; используется `MapView`, когда `getMapProvider() === "yandex"`.

- [ ] **Step 1: Yandex-карта**

Create `src/lib/map/YandexMap.tsx`:
```tsx
"use client";
import { useEffect, useRef } from "react";
import { STATUS_COLORS } from "@/lib/domain/availability";
import type { MapViewProps } from "./provider";

declare global { interface Window { ymaps3?: any } }

async function loadYmaps(apiKey: string) {
  if (window.ymaps3) return window.ymaps3;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/v3/?apikey=${apiKey}&lang=ru_RU`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("ymaps load failed"));
    document.head.appendChild(s);
  });
  await window.ymaps3.ready;
  return window.ymaps3;
}

export default function YandexMap({ markers, onSelect }: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const apiKey = process.env.NEXT_PUBLIC_YANDEX_API_KEY as string;

  useEffect(() => {
    let map: any;
    let cancelled = false;
    (async () => {
      const ymaps3 = await loadYmaps(apiKey);
      if (cancelled || !ref.current) return;
      const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = ymaps3;
      map = new YMap(ref.current, { location: { center: [30.35, 59.94], zoom: 11 } });
      map.addChild(new YMapDefaultSchemeLayer());
      map.addChild(new YMapDefaultFeaturesLayer());
      for (const m of markers) {
        const el = document.createElement("div");
        el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${STATUS_COLORS[m.status]};border:2px solid #fff;cursor:pointer`;
        el.title = m.label;
        el.onclick = () => onSelect(m.id);
        map.addChild(new YMapMarker({ coordinates: [m.lng, m.lat] }, el));
      }
    })();
    return () => { cancelled = true; if (map) map.destroy(); };
  }, [markers, onSelect, apiKey]);

  return <div ref={ref} className="h-full w-full" />;
}
```

- [ ] **Step 2: Переключение в MapView**

Replace `src/lib/map/MapView.tsx`:
```tsx
"use client";
import dynamic from "next/dynamic";
import { getMapProvider, type MapViewProps } from "./provider";

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });
const YandexMap = dynamic(() => import("./YandexMap"), { ssr: false });

export function MapView(props: MapViewProps) {
  return getMapProvider() === "yandex" ? <YandexMap {...props} /> : <LeafletMap {...props} />;
}
```

- [ ] **Step 3: Проверка сборки**

Run: `npm run build`
Expected: без ошибок. Без env-ключа приложение по-прежнему использует Leaflet.

- [ ] **Step 4: Commit**

```bash
git add src/lib/map
git commit -m "feat: optional Yandex map provider via env key"
```

---

## Task 15: Оболочка рабочего стола (3 зоны) + загрузка опций фильтров

**Files:**
- Create: `src/app/workspace/page.tsx`, `src/app/workspace/WorkspaceClient.tsx`
- Create: `src/lib/facets.ts`

**Interfaces:**
- Consumes: `prisma`, `auth`, `MapView`, доменные типы.
- Produces:
  - `src/lib/facets.ts`: `async function loadFacets(): Promise<{ owners: {id:string;name:string}[]; districts: string[]; formats: string[]; types: string[]; sides: string[]; periods: string[] }>`.
  - `<WorkspaceClient facets={...} />` — управляет состоянием: `filters`, `surfaces`, `selectedId`, активный таб карта/список, рабочие списки. 3 зоны через `react-resizable-panels`.

- [ ] **Step 1: Загрузка фасетов**

Create `src/lib/facets.ts`:
```ts
import { prisma } from "@/lib/db";

export async function loadFacets() {
  const [owners, constructions] = await Promise.all([
    prisma.owner.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.construction.findMany({ select: { district: true, format: true, type: true } }),
  ]);
  const uniq = (xs: string[]) => Array.from(new Set(xs)).sort();
  const periods = Array.from({ length: 12 }, (_, m) => `2026-${String(m + 1).padStart(2, "0")}`);
  return {
    owners,
    districts: uniq(constructions.map((c) => c.district)),
    formats: uniq(constructions.map((c) => c.format)),
    types: uniq(constructions.map((c) => c.type)),
    sides: ["А", "Б"],
    periods,
  };
}
```

- [ ] **Step 2: Серверная страница**

Create `src/app/workspace/page.tsx`:
```tsx
import { loadFacets } from "@/lib/facets";
import { WorkspaceClient } from "./WorkspaceClient";

export default async function WorkspacePage() {
  const facets = await loadFacets();
  return <WorkspaceClient facets={facets} />;
}
```

- [ ] **Step 3: Клиентская оболочка на 3 зоны**

Create `src/app/workspace/WorkspaceClient.tsx`:
```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { MapView } from "@/lib/map/MapView";
import type { MapMarker } from "@/lib/map/provider";
import { FilterBar, type Facets, type ActiveFilters } from "@/components/workspace/FilterBar";
import { SurfaceList, type SurfaceListDTO } from "@/components/workspace/SurfaceList";
import { SideCard } from "@/components/workspace/SideCard";
import { WorkingListsPanel } from "@/components/workspace/WorkingListsPanel";

function toQuery(f: ActiveFilters): string {
  const sp = new URLSearchParams();
  f.ownerIds.forEach((v) => sp.append("owner", v));
  f.districts.forEach((v) => sp.append("district", v));
  f.formats.forEach((v) => sp.append("format", v));
  f.types.forEach((v) => sp.append("type", v));
  f.sides.forEach((v) => sp.append("side", v));
  f.periods.forEach((v) => sp.append("period", v));
  f.statuses.forEach((v) => sp.append("status", v));
  if (f.q) sp.set("q", f.q);
  return sp.toString();
}

const EMPTY: ActiveFilters = { ownerIds: [], districts: [], formats: [], types: [], sides: [], periods: [], statuses: [], q: "" };

export function WorkspaceClient({ facets }: { facets: Facets }) {
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY);
  const [surfaces, setSurfaces] = useState<SurfaceListDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"map" | "list">("map");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/surfaces?${toQuery(filters)}`, { signal: ctrl.signal })
      .then((r) => r.json()).then((d) => setSurfaces(d.surfaces ?? [])).catch(() => {});
    return () => ctrl.abort();
  }, [filters]);

  const markers: MapMarker[] = surfaces.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, status: s.status, label: `${s.address} (${s.sideCode})` }));
  const onListsChanged = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white px-4 py-2">
        <h1 className="font-semibold">Личный кабинет FD</h1>
        <a href="/api/auth/signout" className="text-sm text-slate-500">Выйти</a>
      </header>
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={26} minSize={18}>
          <SideCard surfaceId={selectedId} />
        </Panel>
        <PanelResizeHandle className="w-1 bg-slate-200" />
        <Panel defaultSize={48} minSize={30}>
          <div className="flex h-full flex-col">
            <FilterBar facets={facets} filters={filters} onChange={setFilters} tab={tab} onTab={setTab} count={surfaces.length} />
            <div className="relative flex-1">
              {tab === "map"
                ? <MapView markers={markers} selectedId={selectedId} onSelect={setSelectedId} />
                : <SurfaceList surfaces={surfaces} onSelect={setSelectedId} />}
            </div>
          </div>
        </Panel>
        <PanelResizeHandle className="w-1 bg-slate-200" />
        <Panel defaultSize={26} minSize={18}>
          <WorkingListsPanel reloadKey={reloadKey} onChanged={onListsChanged} onLoadToMap={(items) => { setSurfaces(items); setTab("map"); }} />
        </Panel>
      </PanelGroup>
    </div>
  );
}
```

- [ ] **Step 4: Заглушки компонентов, чтобы собралось**

Временно создать пустые экспорты (будут заменены в Task 16-19), чтобы `WorkspaceClient` собирался:
- `src/components/workspace/FilterBar.tsx` — экспорт `Facets`, `ActiveFilters`, `FilterBar` (заглушка `<div/>`).
- `src/components/workspace/SurfaceList.tsx` — экспорт `SurfaceListDTO`, `SurfaceList`.
- `src/components/workspace/SideCard.tsx` — экспорт `SideCard`.
- `src/components/workspace/WorkingListsPanel.tsx` — экспорт `WorkingListsPanel`.

Пример заглушки `FilterBar.tsx`:
```tsx
"use client";
import type { AvailabilityStatus } from "@/lib/domain/availability";
export interface Facets { owners: {id:string;name:string}[]; districts: string[]; formats: string[]; types: string[]; sides: string[]; periods: string[] }
export interface ActiveFilters { ownerIds: string[]; districts: string[]; formats: string[]; types: string[]; sides: string[]; periods: string[]; statuses: AvailabilityStatus[]; q: string }
export function FilterBar(_: { facets: Facets; filters: ActiveFilters; onChange: (f: ActiveFilters) => void; tab: "map"|"list"; onTab: (t: "map"|"list") => void; count: number }) { return <div className="border-b p-2 text-sm">Фильтры</div>; }
```
(аналогичные минимальные заглушки для остальных трёх — с корректными сигнатурами из их Interfaces-блоков ниже.)

- [ ] **Step 5: Проверка**

Run: `npm run dev`, войти как клиент → на `/workspace` видны 3 перетаскиваемые зоны, карта с маркерами по СПб, переключатель Карта/Список.
Expected: карта рендерится, маркеры есть, зоны двигаются.

- [ ] **Step 6: Commit**

```bash
git add src/app/workspace src/lib/facets.ts src/components/workspace
git commit -m "feat: 3-zone workspace shell with live map"
```

---

## Task 16: Панель фильтров

**Files:**
- Modify: `src/components/workspace/FilterBar.tsx`

**Interfaces:**
- Consumes: `Facets`, `ActiveFilters` (определены здесь), `STATUS_LABELS`, `AvailabilityStatus`.
- Produces: полноценный `FilterBar` — мультиселекты по фасетам (владелец/район/формат/тип/сторона/период/статус), поле поиска `q` (debounce 300мс), табы Карта/Список, счётчик найденного.

- [ ] **Step 1: Реализация FilterBar**

Replace `src/components/workspace/FilterBar.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { STATUS_LABELS, type AvailabilityStatus } from "@/lib/domain/availability";

export interface Facets { owners: {id:string;name:string}[]; districts: string[]; formats: string[]; types: string[]; sides: string[]; periods: string[] }
export interface ActiveFilters { ownerIds: string[]; districts: string[]; formats: string[]; types: string[]; sides: string[]; periods: string[]; statuses: AvailabilityStatus[]; q: string }

function Multi({ label, options, values, onChange }: { label: string; options: {value:string;label:string}[]; values: string[]; onChange: (v: string[]) => void }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md border px-2 py-1 text-sm">
        {label}{values.length ? ` (${values.length})` : ""}
      </summary>
      <div className="absolute z-[1000] mt-1 max-h-64 w-56 overflow-auto rounded-md border bg-white p-2 shadow">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 py-0.5 text-sm">
            <input type="checkbox" checked={values.includes(o.value)}
              onChange={(e) => onChange(e.target.checked ? [...values, o.value] : values.filter((x) => x !== o.value))} />
            {o.label}
          </label>
        ))}
      </div>
    </details>
  );
}

export function FilterBar({ facets, filters, onChange, tab, onTab, count }: { facets: Facets; filters: ActiveFilters; onChange: (f: ActiveFilters) => void; tab: "map"|"list"; onTab: (t: "map"|"list") => void; count: number }) {
  const [q, setQ] = useState(filters.q);
  useEffect(() => { const t = setTimeout(() => onChange({ ...filters, q }), 300); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q]);
  const patch = (p: Partial<ActiveFilters>) => onChange({ ...filters, ...p });
  const statusOpts = (Object.keys(STATUS_LABELS) as AvailabilityStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }));

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-white p-2">
      <Multi label="Владелец" options={facets.owners.map((o) => ({ value: o.id, label: o.name }))} values={filters.ownerIds} onChange={(v) => patch({ ownerIds: v })} />
      <Multi label="Район" options={facets.districts.map((d) => ({ value: d, label: d }))} values={filters.districts} onChange={(v) => patch({ districts: v })} />
      <Multi label="Формат" options={facets.formats.map((f) => ({ value: f, label: f }))} values={filters.formats} onChange={(v) => patch({ formats: v })} />
      <Multi label="Тип" options={facets.types.map((t) => ({ value: t, label: t }))} values={filters.types} onChange={(v) => patch({ types: v })} />
      <Multi label="Сторона" options={facets.sides.map((s) => ({ value: s, label: s }))} values={filters.sides} onChange={(v) => patch({ sides: v })} />
      <Multi label="Период" options={facets.periods.map((p) => ({ value: p, label: p }))} values={filters.periods} onChange={(v) => patch({ periods: v })} />
      <Multi label="Свободность" options={statusOpts} values={filters.statuses} onChange={(v) => patch({ statuses: v as AvailabilityStatus[] })} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по адресу/номеру" className="rounded-md border px-2 py-1 text-sm" />
      <div className="ml-auto flex items-center gap-2">
        <span className="text-sm text-slate-500">Найдено: {count}</span>
        <div className="flex overflow-hidden rounded-md border text-sm">
          <button onClick={() => onTab("map")} className={`px-3 py-1 ${tab === "map" ? "bg-slate-900 text-white" : ""}`}>Карта</button>
          <button onClick={() => onTab("list")} className={`px-3 py-1 ${tab === "list" ? "bg-slate-900 text-white" : ""}`}>Список</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Проверка**

Run: `npm run dev` → выбрать район/статус → карта и счётчик обновляются.
Expected: фильтры меняют выборку (запрос уходит на `/api/surfaces`).

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/FilterBar.tsx
git commit -m "feat: filter bar with facet multiselects and search"
```

---

## Task 17: Список поверхностей (TanStack Table + настройка колонок)

**Files:**
- Modify: `src/components/workspace/SurfaceList.tsx`

**Interfaces:**
- Consumes: `STATUS_LABELS`, `STATUS_COLORS`, `AvailabilityStatus`.
- Produces:
  - `interface SurfaceListDTO { id: string; lat: number; lng: number; address: string; district: string; format: string; type: string; ownerName: string; sideCode: string; status: AvailabilityStatus }`
  - `SurfaceList` — таблица с колонками (Адрес, Район, Владелец, Тип, Формат, Сторона, Статус), тумблер видимости колонок, клик по строке → `onSelect(id)`.

- [ ] **Step 1: Реализация списка**

Replace `src/components/workspace/SurfaceList.tsx`:
```tsx
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
                {row.getVisibleCells().map((cell) => <td key={cell.id} className="border-b px-2 py-1">{flexRender(cell.column.columnDef.cell ?? cell.column.columnDef.header, cell.getContext())}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Проверка**

Run: `npm run dev` → вкладка «Список» показывает таблицу, тумблеры колонок скрывают/показывают, клик по строке открывает карточку слева (после Task 18).
Expected: таблица работает, колонки переключаются.

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/SurfaceList.tsx
git commit -m "feat: surface list table with column visibility"
```

---

## Task 18: Карточка стороны + календарь занятости

**Files:**
- Modify: `src/components/workspace/SideCard.tsx`
- Create: `src/components/workspace/AvailabilityCalendar.tsx`

**Interfaces:**
- Consumes: `GET /api/surfaces/[id]`, `POST /api/error-reports`, `STATUS_COLORS`, `STATUS_LABELS`, `MonthAvailability`.
- Produces:
  - `AvailabilityCalendar` — сетка 12 месяцев, цвет по статусу, цена в подписи.
  - `SideCard` — грузит детали при смене `surfaceId`, показывает реквизиты + панораму + календарь + мини-форму ошибок.

- [ ] **Step 1: Календарь**

Create `src/components/workspace/AvailabilityCalendar.tsx`:
```tsx
"use client";
import { STATUS_COLORS, STATUS_LABELS, type MonthAvailability } from "@/lib/domain/availability";

const RU = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
function monthLabel(period: string) { const m = Number(period.split("-")[1]); return RU[m - 1]; }

export function AvailabilityCalendar({ months }: { months: MonthAvailability[] }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {months.map((m) => (
        <div key={m.period} className="rounded-md border p-1 text-center text-xs" title={STATUS_LABELS[m.status]}>
          <div className="font-medium">{monthLabel(m.period)}</div>
          <div className="my-1 h-1.5 rounded-full" style={{ background: STATUS_COLORS[m.status] }} />
          <div className="text-[10px] text-slate-500">{m.priceNet ? m.priceNet.toLocaleString("ru-RU") : "—"}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Карточка**

Replace `src/components/workspace/SideCard.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import type { MonthAvailability } from "@/lib/domain/availability";

interface Detail {
  id: string; sideCode: string; direction: string | null; gid: string | null; surfaceNumber: string | null;
  grp: number | null; ots: number | null; oneShowSec: number | null; showsPerDay: number | null;
  construction: { constructionNumber: string; ownerNumber: string | null; ownerName: string; ownerSite: string | null; type: string; format: string; district: string; address: string; lat: number; lng: number; lighting: boolean; description: string | null; panoramaUrl: string | null };
  months: MonthAvailability[];
}

const REASONS = ["Затереть контакты владельца на фото", "Проверить положение на карте", "Проверить направление А и Б", "Другое"];

export function SideCard({ surfaceId }: { surfaceId: string | null }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!surfaceId) { setDetail(null); return; }
    setSent(false); setReasons([]); setComment("");
    fetch(`/api/surfaces/${surfaceId}`).then((r) => r.json()).then(setDetail).catch(() => setDetail(null));
  }, [surfaceId]);

  if (!surfaceId) return <div className="flex h-full items-center justify-center p-4 text-sm text-slate-400">Выберите поверхность на карте или в списке</div>;
  if (!detail) return <div className="p-4 text-sm text-slate-400">Загрузка…</div>;

  const c = detail.construction;
  async function submitReport() {
    await fetch("/api/error-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ surfaceId, reasons, comment }) });
    setSent(true);
  }

  return (
    <div className="h-full overflow-auto p-3 text-sm">
      <h2 className="font-semibold">{c.address}</h2>
      <p className="text-slate-500">Сторона {detail.sideCode} · {c.type} · {c.format}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1">
        <dt className="text-slate-500">№ Конструкции</dt><dd>{c.constructionNumber}</dd>
        <dt className="text-slate-500">Владелец</dt><dd>{c.ownerName}</dd>
        <dt className="text-slate-500">Район</dt><dd>{c.district}</dd>
        <dt className="text-slate-500">Свет</dt><dd>{c.lighting ? "есть" : "нет"}</dd>
        <dt className="text-slate-500">GRP / OTS</dt><dd>{detail.grp ?? "—"} / {detail.ots ?? "—"}</dd>
        <dt className="text-slate-500">Координаты</dt><dd>{c.lat.toFixed(5)}, {c.lng.toFixed(5)}</dd>
      </dl>
      {c.description && <p className="mt-2 text-slate-600">{c.description}</p>}

      <h3 className="mt-4 mb-1 font-medium">Занятость по месяцам</h3>
      <AvailabilityCalendar months={detail.months} />

      <h3 className="mt-4 mb-1 font-medium">Ошибки, неточности</h3>
      {sent ? <p className="text-green-600">Спасибо, отправлено.</p> : (
        <div className="space-y-1">
          {REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2"><input type="checkbox" checked={reasons.includes(r)} onChange={(e) => setReasons(e.target.checked ? [...reasons, r] : reasons.filter((x) => x !== r))} />{r}</label>
          ))}
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий" className="w-full rounded-md border p-1" />
          <button onClick={submitReport} className="rounded-md bg-slate-900 px-3 py-1 text-white">Отправить</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Проверка**

Run: `npm run dev` → клик по маркеру/строке → слева появляется карточка с календарём 12 месяцев и формой ошибок; отправка формы даёт «Спасибо».
Expected: карточка грузится, календарь цветной, форма отправляется.

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/SideCard.tsx src/components/workspace/AvailabilityCalendar.tsx
git commit -m "feat: side card with availability calendar and error report form"
```

---

## Task 19: Панель рабочих списков

**Files:**
- Modify: `src/components/workspace/WorkingListsPanel.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/working-lists`, `PATCH/DELETE /api/working-lists/[id]`, `POST/DELETE …/items`, `GET …/export`, `SurfaceListDTO`.
- Produces: `WorkingListsPanel` со свойствами `{ reloadKey: number; onChanged: () => void; onLoadToMap: (items: SurfaceListDTO[]) => void }` — вкладки списков, создание/переименование/удаление, вставка ID, таблица позиций, «Загрузить на карту», «Выгрузить в Excel».

- [ ] **Step 1: Реализация панели**

Replace `src/components/workspace/WorkingListsPanel.tsx`:
```tsx
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
```

- [ ] **Step 2: Проверка сквозного сценария**

Run: `npm run dev` → создать список → вставить `776262 776264` → «Добавить» → позиции появились → «Excel» скачивает файл → «На карту» показывает только эти поверхности.
Expected: полный цикл рабочего списка работает.

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/WorkingListsPanel.tsx
git commit -m "feat: working lists panel (CRUD, paste IDs, export, load to map)"
```

---

## Task 20: Легенда статусов + полировка SaaS-стиля

**Files:**
- Create: `src/components/workspace/Legend.tsx`
- Modify: `src/app/workspace/WorkspaceClient.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: `STATUS_LABELS`, `STATUS_COLORS`.
- Produces: `Legend` — горизонтальная легенда 4 статусов; вставляется в шапку зоны карты.

- [ ] **Step 1: Легенда**

Create `src/components/workspace/Legend.tsx`:
```tsx
"use client";
import { STATUS_COLORS, STATUS_LABELS, type AvailabilityStatus } from "@/lib/domain/availability";
export function Legend() {
  const items = Object.keys(STATUS_LABELS) as AvailabilityStatus[];
  return (
    <div className="flex flex-wrap gap-3 px-2 py-1 text-xs text-slate-600">
      {items.map((s) => <span key={s} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[s] }} />{STATUS_LABELS[s]}</span>)}
    </div>
  );
}
```

- [ ] **Step 2: Вставить легенду + мелкая полировка**

В `WorkspaceClient.tsx` добавить `<Legend />` между `FilterBar` и картой (импортировать компонент). В `globals.css` задать базовый фон `body { background: #f8fafc; }` и убедиться, что `html, body, #__next` имеют `height: 100%` для полноэкранной карты.

- [ ] **Step 3: Проверка**

Run: `npm run dev` → под фильтрами видна легенда 4 статусов; цвета совпадают с маркерами.
Expected: легенда отображается, интерфейс аккуратный.

- [ ] **Step 4: Commit**

```bash
git add src/components/workspace/Legend.tsx src/app/workspace/WorkspaceClient.tsx src/app/globals.css
git commit -m "feat: status legend and layout polish"
```

---

## Task 21: E2E smoke-тест (Playwright)

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: запущенное приложение (`npm run dev`/`start`), сид-данные.

- [ ] **Step 1: Конфиг Playwright**

Create `playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120000 },
});
```

Run once: `npx playwright install chromium`.

- [ ] **Step 2: Smoke-сценарий**

Create `tests/e2e/smoke.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("client can log in, filter, build a list and export", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Войти как Клиент" }).click();
  await page.waitForURL("**/workspace");

  // фильтры и карта видны
  await expect(page.getByText("Найдено:")).toBeVisible();

  // создать список
  page.once("dialog", (d) => d.accept("E2E список"));
  await page.getByRole("button", { name: "+ список" }).click();
  await expect(page.getByRole("button", { name: /E2E список/ })).toBeVisible();

  // добавить поверхность по номеру
  await page.getByPlaceholder("№ поверхностей через пробел/запятую").fill("776262");
  await page.getByRole("button", { name: "Добавить" }).click();

  // экспорт скачивается
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Excel" }).click(),
  ]);
  expect(download.suggestedFilename()).toContain(".xlsx");
});
```

- [ ] **Step 3: Прогнать все тесты**

Run: `npm test && npm run e2e`
Expected: unit-тесты (availability, id-paste, filters, export) — PASS; e2e smoke — PASS.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e
git commit -m "test: e2e smoke for login → filter → list → export"
```

---

## Task 22: README и конфигурация деплоя

**Files:**
- Create: `README.md`
- Modify: `.env.example`

**Interfaces:** нет (документация).

- [ ] **Step 1: README**

Create `README.md` с разделами: что это (демо ЛК медиаселлера OOH), стек, скриншоты (плейсхолдеры), быстрый старт локально (`docker compose up -d`, `npm i`, `npx prisma migrate dev`, `npm run db:seed`, `npm run dev`), демо-креды (`client@demo`/`admin@demo`, пароль `demo1234`), переключение карты на Yandex (`NEXT_PUBLIC_YANDEX_API_KEY`), деплой на Vercel + Neon (задать `DATABASE_URL`, `AUTH_SECRET`, применить миграции, запустить seed), список реализованного и «дальше — админка (План 2)».

- [ ] **Step 2: Финальная проверка сборки и тестов**

Run: `npm run build && npm test`
Expected: сборка и unit-тесты зелёные.

- [ ] **Step 3: Commit**

```bash
git add README.md .env.example
git commit -m "docs: README with setup, demo creds and deploy notes"
```

---

## Self-Review (проведено при написании плана)

**Покрытие спеки:**
- Роли/авторизация/демо-креды → Task 8, 9.
- Модель данных → Task 2; seed по СПб → Task 3.
- Доменная логика (занятость, фильтры, парсер ID, экспорт) → Task 4–7.
- API поиска/деталей/списков/экспорта/ошибок → Task 10–12.
- Карта-адаптер OSM + опц. Yandex → Task 13–14.
- 3-зонный рабочий стол, фильтры, карта, список, карточка+календарь, рабочие списки → Task 15–20.
- Тесты (unit + e2e) → Task 4–7, 21. Деплой/README → Task 22.
- Вне объёма этого плана (осознанно): админка, импорт фидов — уйдут в **План 2**.

**Заглушки:** во всех шагах приведён реальный код/команды; в Task 15 заглушки компонентов помечены как временные и заменяются в Task 16–19.

**Согласованность типов:** `SurfaceListDTO`, `MonthAvailability`, `MapMarker`, `ActiveFilters`, `Facets`, `AvailabilityStatus` определены один раз и переиспользуются; имена методов (`aggregateStatus`, `buildSurfaceWhere`, `parsePastedIds`, `buildWorkbook`, `getMapProvider`) стабильны между задачами.
