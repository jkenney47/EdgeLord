const easternFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true
});

export function formatEasternTime(timestamp: string | number): string {
  const date = new Date(typeof timestamp === "number" ? timestamp * 1000 : timestamp);
  const parts = Object.fromEntries(easternFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.weekday} ${parts.month} ${parts.day}, ${parts.year} ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}
