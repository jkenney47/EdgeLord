import type { Bar, Ticker, Trade } from "./api";

export type OpenTradeSelectionContext = {
  tone: "active" | "warn";
  title: string;
  detail: string;
  returnPct: number | null;
};

export function getOpenTradeSelectionContext(
  selected: Bar | null,
  openTrade: Trade | null,
  activeTicker: Ticker
): OpenTradeSelectionContext | null {
  if (!selected || !openTrade) return null;

  if (activeTicker !== openTrade.ticker || selected.ticker !== openTrade.ticker) {
    return {
      tone: "warn",
      title: `Open ${openTrade.ticker} trade`,
      detail: `Switch to ${openTrade.ticker} to review the exit. Opposite entries stay blocked until it is closed.`,
      returnPct: null
    };
  }

  if (selected.timestamp < openTrade.entry_timestamp) {
    return {
      tone: "warn",
      title: "Before open entry",
      detail: `Entry is ${formatDate(openTrade.entry_timestamp)} at ${openTrade.entry_price.toFixed(2)}.`,
      returnPct: null
    };
  }

  const returnPct = ((selected.close - openTrade.entry_price) / openTrade.entry_price) * 100;
  return {
    tone: "active",
    title: `Reviewing ${openTrade.ticker} exit`,
    detail: `Entry ${formatDate(openTrade.entry_timestamp)} at ${openTrade.entry_price.toFixed(2)}; selected close ${selected.close.toFixed(2)}.`,
    returnPct: Number(returnPct.toFixed(2))
  };
}

function formatDate(timestamp: string): string {
  return timestamp.slice(0, 10);
}
