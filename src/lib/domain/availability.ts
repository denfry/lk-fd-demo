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
