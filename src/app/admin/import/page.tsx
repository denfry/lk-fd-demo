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
