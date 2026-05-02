import { nanoid } from "nanoid";

import { db, nowIso } from "./db";
import type { Label, Ticker, Trade } from "./schema";

export function getTrades(): Trade[] {
  return db.prepare("select * from trades order by created_at asc").all() as Trade[];
}

export function getOpenTrade(): Trade | null {
  return db.prepare("select * from trades where status = 'open' order by created_at desc limit 1").get() as Trade | undefined ?? null;
}

function insertOpenTrade(entry: Label, createdAt = nowIso()): Trade {
  const trade: Trade = {
    id: entry.trade_id ?? `trade-${nanoid(10)}`,
    ticker: entry.ticker,
    entry_label_id: entry.id,
    exit_label_id: null,
    entry_timestamp: entry.timestamp,
    exit_timestamp: null,
    entry_price: entry.chart_price,
    exit_price: null,
    return_pct: null,
    status: "open",
    created_at: createdAt,
    updated_at: createdAt
  };

  db.prepare(`
    insert into trades (id, ticker, entry_label_id, exit_label_id, entry_timestamp, exit_timestamp, entry_price, exit_price, return_pct, status, created_at, updated_at)
    values (@id, @ticker, @entry_label_id, @exit_label_id, @entry_timestamp, @exit_timestamp, @entry_price, @exit_price, @return_pct, @status, @created_at, @updated_at)
  `).run(trade);
  return trade;
}

export function createTrade(entry: Label): Trade {
  return insertOpenTrade(entry);
}

export function closeTrade(exit: Label, updatedAt = nowIso()): Trade {
  const openTrade = getOpenTrade();
  if (!openTrade || openTrade.ticker !== exit.ticker) {
    throw new Error(`No open ${exit.ticker} trade to exit`);
  }

  const returnPct = ((exit.chart_price - openTrade.entry_price) / openTrade.entry_price) * 100;
  db.prepare(`
    update trades
    set exit_label_id = ?, exit_timestamp = ?, exit_price = ?, return_pct = ?, status = 'closed', updated_at = ?
    where id = ?
  `).run(exit.id, exit.timestamp, exit.chart_price, returnPct, updatedAt, openTrade.id);

  return db.prepare("select * from trades where id = ?").get(openTrade.id) as Trade;
}

export function rebuildTrades(labels: Label[]): void {
  const rebuild = db.transaction((items: Label[]) => {
    db.prepare("delete from trades").run();
    for (const label of items) {
      if (label.action === "ENTRY") {
        const entry = { ...label, trade_id: label.trade_id ?? `trade-${nanoid(10)}`, parent_entry_label_id: null };
        db.prepare("update labels set trade_id = ?, parent_entry_label_id = null where id = ?").run(entry.trade_id, entry.id);
        insertOpenTrade(entry, entry.created_at);
      } else if (label.action === "EXIT") {
        const open = getOpenTrade();
        if (open && open.ticker === label.ticker) {
          const exit = { ...label, trade_id: open.id, parent_entry_label_id: open.entry_label_id };
          db.prepare("update labels set trade_id = ?, parent_entry_label_id = ? where id = ?").run(open.id, open.entry_label_id, exit.id);
          closeTrade(exit, exit.created_at);
        } else {
          db.prepare("update labels set training_eligible = 0, trade_id = null, parent_entry_label_id = null where id = ?").run(label.id);
        }
      } else {
        db.prepare("update labels set trade_id = null, parent_entry_label_id = null where id = ?").run(label.id);
      }
    }
  });

  rebuild(labels.filter((label) => label.deleted_at === null));
}

export function canEnter(ticker: Ticker): { ok: true } | { ok: false; reason: string } {
  const open = getOpenTrade();
  if (!open) return { ok: true };
  return { ok: false, reason: `Exit open ${open.ticker} trade before entering ${ticker}.` };
}

export function canExit(ticker: Ticker): { ok: true } | { ok: false; reason: string } {
  const open = getOpenTrade();
  if (!open) return { ok: false, reason: "No open trade to exit." };
  if (open.ticker !== ticker) return { ok: false, reason: `Open trade is ${open.ticker}; select ${open.ticker} to exit.` };
  return { ok: true };
}
