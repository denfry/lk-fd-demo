"use client";

export function SideCard({ surfaceId }: { surfaceId: string | null }) {
  return <div className="flex h-full items-center justify-center p-4 text-sm text-slate-400">{surfaceId ? `Карточка (заглушка): ${surfaceId}` : "Выберите поверхность на карте или в списке"}</div>;
}
