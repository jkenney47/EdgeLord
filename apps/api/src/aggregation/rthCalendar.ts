import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const MARKET_TIMEZONE = "America/New_York";

export type NewYorkTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toNewYorkTime(timestamp: string | Date): NewYorkTimeParts {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const zoned = toZonedTime(date, MARKET_TIMEZONE);

  return {
    year: zoned.getFullYear(),
    month: zoned.getMonth() + 1,
    day: zoned.getDate(),
    hour: zoned.getHours(),
    minute: zoned.getMinutes()
  };
}

export function sessionDateForTimestamp(timestamp: string | Date): string {
  const parts = toNewYorkTime(timestamp);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function sessionOpenForDate(sessionDate: string): string {
  return fromZonedTime(`${sessionDate}T09:30:00`, MARKET_TIMEZONE).toISOString();
}

export function sessionCloseForDate(sessionDate: string): string {
  return fromZonedTime(`${sessionDate}T16:00:00`, MARKET_TIMEZONE).toISOString();
}

export function isRegularTradingMinute(timestamp: string | Date): boolean {
  const parts = toNewYorkTime(timestamp);
  const minutesSinceMidnight = parts.hour * 60 + parts.minute;
  const open = 9 * 60 + 30;
  const close = 16 * 60;

  return minutesSinceMidnight >= open && minutesSinceMidnight < close;
}
