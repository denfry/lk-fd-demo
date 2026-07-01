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
