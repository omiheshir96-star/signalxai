import { createInsertSchema } from "drizzle-zod";
import {
  doublePrecision,
  index,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const signalxSignalsTable = pgTable(
  "signalx_signals",
  {
    id: serial("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    side: varchar("side", { length: 4 }).notNull(),
    confidence: doublePrecision("confidence").notNull(),
    price: doublePrecision("price").notNull(),
    rsi: doublePrecision("rsi").notNull(),
    volatility: doublePrecision("volatility").notNull(),
    reasons: text("reasons").notNull(),
    result: varchar("result", { length: 20 }).notNull().default("PENDING"),
  },
  (table) => [
    index("signalx_signals_created_at_idx").on(table.createdAt),
    index("signalx_signals_symbol_side_created_idx").on(
      table.symbol,
      table.side,
      table.createdAt,
    ),
  ],
);

export const insertSignalxSignalSchema = createInsertSchema(
  signalxSignalsTable,
).omit({ id: true, createdAt: true });

export type InsertSignalxSignal = z.infer<typeof insertSignalxSignalSchema>;
export type SignalxSignal = typeof signalxSignalsTable.$inferSelect;