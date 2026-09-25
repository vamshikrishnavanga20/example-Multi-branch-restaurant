import { RequestBody, ResolvedRange } from "./types";

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
}

export function getKolkataParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";

  return {
    year: Number(getPart("year")),
    month: Number(getPart("month")),
    day: Number(getPart("day")),
    hour: Number(getPart("hour")),
    minute: Number(getPart("minute")),
    second: Number(getPart("second")),
  };
}

export function formatDate(year: number, month: number, day: number): string {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

export function addDaysToDateString(dateString: string, amount: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function kolkataLocalToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond = 0
): string {
  const utcMilliseconds =
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond) - 5.5 * 60 * 60 * 1000;
  return new Date(utcMilliseconds).toISOString();
}

export function getPresetRange(timeframe: "today" | "7d" | "30d"): ResolvedRange {
  const now = getKolkataParts();
  const today = formatDate(now.year, now.month, now.day);
  let displayStartDate = today;

  if (timeframe === "7d") {
    displayStartDate = addDaysToDateString(today, -6);
  } else if (timeframe === "30d") {
    displayStartDate = addDaysToDateString(today, -29);
  }

  const [startYear, startMonth, startDay] = displayStartDate.split("-").map(Number);
  const startDate = kolkataLocalToUtcIso(startYear, startMonth, startDay, 0, 0, 0, 0);
  const endDate = kolkataLocalToUtcIso(now.year, now.month, now.day, 23, 59, 59, 999);

  return {
    kind: timeframe,
    startDate,
    endDate,
    displayStartDate,
    displayEndDate: today,
  };
}

export function getCustomRange(startDateString: string, endDateString: string): ResolvedRange {
  if (!isValidDateString(startDateString) || !isValidDateString(endDateString)) {
    throw new Error("Invalid custom date range.");
  }
  if (endDateString < startDateString) {
    throw new Error("Custom end date cannot be before start date.");
  }

  const [startYear, startMonth, startDay] = startDateString.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDateString.split("-").map(Number);

  const startDate = kolkataLocalToUtcIso(startYear, startMonth, startDay, 0, 0, 0, 0);
  const endDate = kolkataLocalToUtcIso(endYear, endMonth, endDay, 23, 59, 59, 999);

  return {
    kind: "custom",
    startDate,
    endDate,
    displayStartDate: startDateString,
    displayEndDate: endDateString,
  };
}

export function resolveRequestRange(body: RequestBody): ResolvedRange {
  const range = body.range;

  if (range?.kind === "custom") {
    return getCustomRange(range.startDate, range.endDate);
  }
  if (range?.kind === "today" || range?.kind === "7d" || range?.kind === "30d") {
    return getPresetRange(range.kind);
  }
  if (body.timeframe === "today" || body.timeframe === "7d" || body.timeframe === "30d") {
    return getPresetRange(body.timeframe);
  }
  return getPresetRange("30d");
}
