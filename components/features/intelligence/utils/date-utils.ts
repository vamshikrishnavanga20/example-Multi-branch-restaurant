import { DateFilter } from "../types";

export function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function getRangeStart(filter: DateFilter): Date {
  const now = new Date();
  const today = startOfLocalDay(now);

  switch (filter) {
    case "today":
      return today;
    case "7d": {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return d;
    }
    case "30d": {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      return d;
    }
    default:
      return today;
  }
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}
