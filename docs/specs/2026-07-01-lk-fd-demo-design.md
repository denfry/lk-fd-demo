# LK FD client portal demo — design spec

**Date:** 2026-07-01
**Status:** approved for implementation
**Format:** full-stack portfolio demo

## 1. Context and goal

A demo version of a client portal for an out-of-home (OOH) advertising media seller, based on a real client brief (`Личный кабинет FD Техзадание.xlsx`, kept private). The system aggregates ad constructions from several Owners and lets an advertiser Client choose ad surfaces: search on a map or in a list, view availability by month, build working lists and export them to Excel.

**Goal of the artifact:** show the **full full-stack development cycle** in a portfolio (data model, API, authentication, interactive frontend, map, export, admin panel, tests, deployment). The demo must work out of the box from a public link with no manual key setup.

**Roles:**
- **Client** works in the "Workspace": map/list of surfaces, a surface card with availability by month, working lists, Excel export.
- **Admin** manages reference data (owners, constructions, surfaces, prices), imports a feed and creates clients.

Login is by email and password. The login page has "Sign in as Client / as Admin" buttons with prefilled demo credentials (one click to either role).

## 2. Data model (Prisma / PostgreSQL)

- **Owner:** `name, site, phone, email, contactPerson`.
- **Client:** `name, site, phone, email, contactPerson`.
- **User:** `email, passwordHash, name, role (CLIENT | ADMIN), clientId?`.
- **Construction:** `ownerId, constructionNumber, ownerNumber, type, format, district, address, lat, lng, lighting, description, panoramaUrl`.
- **Surface** (a side of a construction): `constructionId, sideCode, direction, gid, surfaceNumber, photoUrl, mapPhotoUrl, grp, ots, esparId, oneShowSec, showsPerDay, material, printType, montage`.
- **Availability** (by month): `surfaceId, period (first day of the month), status (FREE | SOLD | RESERVED_OTHER | NEEDS_CHECK), priceNet, priceGross`. Unique on `(surfaceId, period)`.
- **WorkingList:** `clientId, name, createdAt`.
- **WorkingListItem:** `workingListId, surfaceId, addedAt`. Unique on `(workingListId, surfaceId)`.
- **FeedImport** (import log): `fileName, importedAt, createdCount, updatedCount, ownerId?`.

Availability statuses follow the legend of the brief: Free / Sold / Reserved by others / Availability must be confirmed.

## 3. Architecture and stack

- **Next.js** (App Router, TypeScript): frontend and API in one repository.
- **Tailwind CSS:** a modern light SaaS look (typography, soft shadows, an accent color, dense but readable tables).
- **Prisma + PostgreSQL:** local via docker-compose, deployed to Neon or Vercel Postgres.
- **Auth.js (NextAuth v5):** credentials provider, roles, middleware protecting `/admin`.
- **API:** Next.js Route Handlers (`/api/...`), input validated with **Zod**.
- **Tables:** TanStack Table (column visibility settings, as required by the brief).
- **Workspace zones:** `react-resizable-panels` (three independent zones moved with splitters).
- **Filter state:** kept in the URL (`searchParams`) so a selection can be shared by link.
- **Export:** `exceljs`, `.xlsx` generated on the server.

## 4. Screens

### Client: "Workspace" (3 zones, resizable with splitters)

1. **Surface card:** surface details (construction/owner number, owner, type, format, coordinates, lighting, GRP/OTS, description), photo and panorama, an **availability calendar by month** (color = status, price shown for sold/available months), and a small "Errors, inaccuracies" form (saved, with a toast).
2. **Map / List** (tabs) and a filter bar: Owner, District, Format, Construction type, Side, Period, Availability.
   - **Map:** react-leaflet, clustered markers, color by status; clicking a marker opens the surface card in zone 1.
   - **List:** a TanStack table with column visibility settings; clicking a row opens the card.
3. **Working lists:** list tabs with create / rename / save / delete; adding surfaces by ID (paste several numbers at once); an items table; "Load onto map" (filters the map by the list); "Export to Excel".

### Admin

- **Owners** reference (CRUD).
- **Constructions, surfaces and prices** (CRUD; prices and statuses by month).
- **Clients and users** (CRUD).
- **Feed import:** upload a normalized CSV/XLSX file, create or update surfaces and availability, and write a `FeedImport` log entry.
- A small dashboard with statistics (number of constructions, surfaces, occupancy percentage).

## 5. Map layer (adapter)

A `MapProvider` interface with two implementations:
- **LeafletProvider** (default): react-leaflet + OpenStreetMap + markercluster, **no API key**. The demo always works.
- **YandexProvider:** loads the Yandex JS API 3.0 **if** `NEXT_PUBLIC_YANDEX_API_KEY` is set; adds panoramas.

The provider is chosen by the presence of the environment key. The default is OSM.

**Why this map choice:** 2GIS is ruled out (Map Tiles API tiles are paid and the demo key lives for one month, which does not suit a permanent portfolio). The Yandex JS API 3.0 is genuinely free (25,000 requests per day) but needs a key bound to a domain. OSM is free and keyless. The adapter takes the best of both: it works for any viewer on OSM and can optionally show the "authentic" Yandex map with panoramas.

## 6. Demo data (seed)

The seed script generates **about 200 surfaces across Saint Petersburg and the surrounding region** with realistic coordinates, assigned to the owners named in the brief (Билбордпост, Гриф, РИМ, РУСС, ЭЛВИС, Реклама Центр, Перспектива, Леноблреклама, POSTEXX). Each surface gets availability and prices by month for 2026 across the 4 statuses. Clients: ЛЭНЖИ, ДСК, Ресторан Фокс, КАНТРИ ХАУС. Demo users: `client@demo` and `admin@demo`. Photos and panoramas are placeholders.

## 7. Out of scope (YAGNI for a demo)

- Actually sending emails (the error form only saves and shows a toast).
- Parsing each owner's exotic Excel layout (import supports one normalized CSV/XLSX format).
- Hosting real photos and panoramas.
- Payments, contracts, booking with locking.
- Reproducing every column of every owner exactly.
- Multi-language support (Russian only).

## 8. Testing and deployment

- **Vitest:** unit tests for business logic: availability calculation and aggregation, price formats, filter application, ID paste parsing.
- **Playwright:** e2e smoke test: sign in, apply a filter, add a surface to a working list, export to Excel.
- Deployment to **Vercel + Neon**. The README covers demo credentials, local setup (docker-compose Postgres, migrations, seed) and screenshots.

## 9. Acceptance criteria

- The public link opens and signs in with one click as either role.
- The map shows about 200 markers in Saint Petersburg; filters change both the map and the list.
- Clicking a marker or a row opens the card with the availability calendar.
- A working list can be created, filled with surfaces and exported to a correct `.xlsx`.
- The admin panel can create an owner, construction and surface, and import a feed.
- Unit and e2e tests pass; the README reproduces a setup from scratch.
