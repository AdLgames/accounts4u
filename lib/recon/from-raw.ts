import { parseDecimal } from "../money";
import type { BalanceTransaction, BalanceTransactionType, Payout } from "./types";

const KNOWN_TRANSACTION_TYPES = new Set<BalanceTransactionType>([
  "charge",
  "refund",
  "dispute",
  "reserve",
  "adjustment",
]);

function normalizeType(raw: unknown): BalanceTransactionType {
  const type = typeof raw === "string" ? raw : "";
  return KNOWN_TRANSACTION_TYPES.has(type as BalanceTransactionType) ? (type as BalanceTransactionType) : "other";
}

/**
 * Converts a raw Shopify Payout REST payload (as stored in raw_payouts.payload)
 * into the normalized Payout type. Uses only the well-established top-level
 * fields (id, status, currency, amount, date) rather than the Payout
 * resource's nested `summary` breakdown, whose exact field names aren't
 * verified against a live payout export from this sandbox — explainPayout
 * rebuilds the breakdown from balance transactions instead of trusting that.
 */
export function payoutFromRaw(raw: Record<string, unknown>): Payout {
  return {
    id: String(raw.id),
    status: String(raw.status ?? "unknown"),
    currency: String(raw.currency ?? ""),
    amount: parseDecimal(String(raw.amount ?? "0")),
    date: new Date(String(raw.date)),
  };
}

/**
 * Converts a raw Shopify Balance Transaction REST payload (as stored in
 * raw_transactions.payload) into the normalized BalanceTransaction type.
 * Not verified against a live payout export yet — re-check field names
 * (id, type, amount, fee, net, source_order_id, processed_at) against real
 * data before trusting this in production; any bug found becomes a new
 * fixture per CLAUDE.md.
 *
 * taxRemittedByPlatform isn't derivable from a balance transaction alone —
 * it's an attribute of the order's tax_lines, not the payment. Pass a
 * lookup (built from raw_orders) if that tagging matters; otherwise every
 * transaction gets taxRemittedByPlatform: null.
 */
export function balanceTransactionFromRaw(
  raw: Record<string, unknown>,
  taxRemittedByPlatform?: (orderId: string) => boolean | null,
): BalanceTransaction {
  const sourceOrderId = raw.source_order_id != null ? String(raw.source_order_id) : null;

  return {
    id: String(raw.id),
    type: normalizeType(raw.type),
    amount: parseDecimal(String(raw.amount ?? "0")),
    fee: parseDecimal(String(raw.fee ?? "0")),
    net: parseDecimal(String(raw.net ?? "0")),
    currency: String(raw.currency ?? ""),
    sourceOrderId,
    taxRemittedByPlatform: sourceOrderId && taxRemittedByPlatform ? taxRemittedByPlatform(sourceOrderId) : null,
    processedAt: new Date(String(raw.processed_at ?? raw.processedAt ?? Date.now())),
  };
}
