# Личный кабинет FD

**Full-stack демо личного кабинета медиаселлера наружной рекламы (OOH):**
интерактивная карта размещений, подбор рекламных поверхностей, занятость по
месяцам, рабочие списки с выгрузкой в Excel и админ-панель с импортом фидов.

<p>
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green.svg">
  <img alt="CI" src="https://github.com/denfry/lk-fd-demo/actions/workflows/ci.yml/badge.svg">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white">
</p>

![Рабочий стол — карта размещений](docs/screenshots/workspace-map.png)

> Демо-проект для портфолио на основе реального техзадания. Данные —
> сгенерированные (≈200 поверхностей по Санкт-Петербургу), фото/панорамы —
> плейсхолдеры. Карта работает «из коробки» на OpenStreetMap, без ключей.

## Демо-доступ (вход в один клик)

На странице `/login` — кнопки «Войти как Клиент / как Админ»:

| Роль    | Логин         | Пароль     |
|---------|---------------|------------|
| Клиент  | `client@demo` | `demo1234` |
| Админ   | `admin@demo`  | `demo1234` |

## Скриншоты

Карточка стороны с календарём занятости по месяцам и формой правок:

![Карточка и список](docs/screenshots/workspace-card.png)

Админка (роль `ADMIN`): дашборд, справочники и импорт фида:

![Админка](docs/screenshots/admin-dashboard.png)

## Возможности

### Кабинет клиента

- **Вход по логину/паролю** (Auth.js, роли `CLIENT`/`ADMIN`), защита маршрутов.
- **3-зонный рабочий стол** с перетаскиваемыми бегунками (react-resizable-panels).
- **Карта** (Leaflet + OpenStreetMap) с кластеризацией маркеров и цветом по статусу;
  опционально — Яндекс.Карты по env-ключу.
- **Фильтры** по владельцу, району, формату, типу, стороне, периоду и свободности
  (состояние отражается в запросе к API).
- **Список** (TanStack Table) с настройкой видимости колонок.
- **Карточка стороны**: реквизиты, GRP/OTS, координаты, **календарь занятости по
  месяцам** (Свободно / Продано / Чужой резерв / Уточнить + цена), форма «Ошибки,
  неточности».
- **Рабочие списки**: создание/переименование/удаление, добавление поверхностей
  по номерам (вставка нескольких ID), «Загрузить на карту», **выгрузка в Excel**.

### Админка (роль `ADMIN`, `/admin`)

- **Дашборд** со статистикой (владельцы, клиенты, конструкции, поверхности, % занятости).
- **Владельцы** — CRUD (с защитой от удаления при наличии конструкций).
- **Клиенты и пользователи** — создание клиента с логином/паролем; новый пользователь
  сразу может войти в кабинет.
- **Конструкции и стороны** — список с поиском/пагинацией, создание, **редактор
  занятости и цен по месяцам** (изменения сразу видны клиенту).
- **Импорт фида** — загрузка нормализованного CSV/XLSX: идемпотентный upsert
  владелец → конструкция → сторона → занятость, лог импортов, отчёт об ошибках строк.
  Формат и пример — см. `docs/samples/feed-sample.csv`.

## Стек

Next.js 16 (App Router, TypeScript) · Prisma 6 + PostgreSQL · Auth.js (NextAuth v5)
· Tailwind CSS · TanStack Table · react-leaflet + leaflet.markercluster · exceljs ·
papaparse · Zod · Vitest · Playwright.

## Быстрый старт (локально)

Требуется Node ≥ 20 и Docker.

```bash
# 1. Зависимости
npm install

# 2. База данных (PostgreSQL в Docker)
docker compose up -d

# 3. Окружение
cp .env.example .env        # при необходимости поменяйте AUTH_SECRET

# 4. Схема и демо-данные
npx prisma migrate dev
npm run db:seed

# 5. Запуск
npm run dev                 # http://localhost:3000
```

### Демо-доступы (на странице входа — кнопки в один клик)

| Роль    | Логин         | Пароль     |
|---------|---------------|------------|
| Клиент  | `client@demo` | `demo1234` |
| Админ   | `admin@demo`  | `demo1234` |

## Карта: OpenStreetMap или Яндекс

По умолчанию используется бесплатный Leaflet + OpenStreetMap (без ключа —
работает сразу). Чтобы переключиться на Яндекс.Карты (с панорамами), задайте в
`.env`:

```
NEXT_PUBLIC_YANDEX_API_KEY="ваш-ключ"
```

Ключ получается бесплатно в кабинете разработчика Яндекса (JS API 3.0,
25 000 запросов/день). Выбор провайдера — автоматически по наличию ключа.

## Тесты

```bash
npm test     # unit (Vitest): занятость, фильтры, парсер ID, экспорт, парсер фида
npm run e2e  # e2e (Playwright): клиентский путь + доступ к админке
```

## Деплой

Рекомендуется Vercel + управляемый PostgreSQL (Neon / Vercel Postgres):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/denfry/lk-fd-demo)

1. Заведите бесплатную БД (Neon) и задайте переменные окружения:
   `DATABASE_URL`, `AUTH_SECRET` (и опционально `NEXT_PUBLIC_YANDEX_API_KEY`).
2. Примените миграции к боевой БД: `npx prisma migrate deploy`.
3. Заполните демо-данными: `npm run db:seed`.

> После деплоя демо открывается по публичной ссылке и работает сразу — карта на
> OpenStreetMap не требует ключей, вход в кабинет в один клик.

## Структура

```
prisma/                 # схема, миграции, seed
src/lib/domain/         # чистая бизнес-логика (покрыта unit-тестами: занятость, фильтры, ID, экспорт, фид)
src/lib/map/            # адаптер карты (Leaflet по умолчанию, Yandex опционально)
src/lib/admin/          # серверные хелперы админки (guard, stats, api-guard)
src/app/api/            # REST-эндпоинты клиента (surfaces, working-lists, error-reports, auth)
src/app/api/admin/      # REST-эндпоинты админки (owners, clients, constructions, surfaces, feed-import)
src/app/workspace/      # рабочий стол клиента
src/app/admin/          # админ-панель (дашборд, справочники, импорт)
src/components/          # workspace/* и admin/* компоненты
tests/                  # unit (Vitest) + e2e (Playwright)
```

## Дальнейшее развитие

Оба этапа реализованы: **План 1** — кабинет клиента, **План 2** — админка и импорт
фидов (см. `docs/plans/`). Возможные направления: отправка отчётов об
ошибках на почту, ролевая модель менеджеров, реальные фото/панорамы, аналитика.
