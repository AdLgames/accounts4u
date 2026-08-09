import { parseDecimal, type MinorUnits } from "../money";
import { BILL_CATEGORIES, type BillCategory, type BillInput, type BillStatus } from "./types";

// Bulk bill entry, since Shopify's own Bill Pay has no public API to read
// from (confirmed via research) -- this is our own template, not tied to
// any third-party export format. Columns: incurred_date,vendor,category,
// amount,status,paid_date. Dates are strict YYYY-MM-DD (no MM/DD guessing).
const EXPECTED_HEADER = ["incurred_date", "vendor", "category", "amount", "status", "paid_date"];

const STRICT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface BillCsvRowError {
  /** 1-indexed against the file; header is row 1, so the first data row is row 2. */
  row: number;
  message: string;
}

export interface ParseBillsCsvResult {
  valid: BillInput[];
  errors: BillCsvRowError[];
}

/**
 * Never throws on a malformed row -- every row is validated independently
 * and sorted into `valid` or `errors`, so a file with 198 good rows and 2
 * typos still imports the 198. Only whole-file problems (empty file, wrong
 * header) throw, since there's no per-row recovery possible there.
 */
export function parseBillsCsv(csvText: string): ParseBillsCsvResult {
  const lines = splitCsvLines(csvText);
  if (lines.length === 0) {
    throw new TypeError("CSV file is empty");
  }

  const header = parseCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase());
  const headerMatches = header.length === EXPECTED_HEADER.length && EXPECTED_HEADER.every((col, i) => header[i] === col);
  if (!headerMatches) {
    throw new TypeError(`CSV header must be exactly: ${EXPECTED_HEADER.join(",")}`);
  }

  const valid: BillInput[] = [];
  const errors: BillCsvRowError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const row = i + 1;
    if (line.trim() === "") continue;

    const cells = parseCsvLine(line);
    if (cells.length !== EXPECTED_HEADER.length) {
      errors.push({ row, message: `Expected ${EXPECTED_HEADER.length} columns, got ${cells.length}` });
      continue;
    }
    const [incurredDateRaw, vendorRaw, categoryRaw, amountRaw, statusRaw, paidDateRaw] = cells;

    const vendor = vendorRaw.trim();
    if (vendor === "") {
      errors.push({ row, message: "vendor is required" });
      continue;
    }

    const incurredOn = parseStrictDate(incurredDateRaw.trim());
    if (!incurredOn) {
      errors.push({ row, message: `incurred_date must be YYYY-MM-DD, got "${incurredDateRaw.trim()}"` });
      continue;
    }

    const category = matchCategory(categoryRaw.trim());
    if (!category) {
      errors.push({ row, message: `category "${categoryRaw.trim()}" is not one of: ${BILL_CATEGORIES.join(", ")}` });
      continue;
    }

    let amount: MinorUnits;
    try {
      amount = parseDecimal(amountRaw.trim());
    } catch {
      errors.push({ row, message: `amount "${amountRaw.trim()}" is not a valid decimal` });
      continue;
    }
    if (amount <= 0) {
      errors.push({ row, message: "amount must be greater than zero" });
      continue;
    }

    const statusLower = statusRaw.trim().toLowerCase();
    if (statusLower !== "paid" && statusLower !== "unpaid") {
      errors.push({ row, message: `status must be "paid" or "unpaid", got "${statusRaw.trim()}"` });
      continue;
    }
    const status = statusLower as BillStatus;

    const paidDateTrimmed = paidDateRaw.trim();
    let paidOn: Date | null = null;
    if (status === "paid") {
      paidOn = parseStrictDate(paidDateTrimmed);
      if (!paidOn) {
        errors.push({ row, message: `paid_date must be YYYY-MM-DD when status is paid, got "${paidDateTrimmed}"` });
        continue;
      }
    } else if (paidDateTrimmed !== "") {
      errors.push({ row, message: "paid_date must be blank when status is unpaid" });
      continue;
    }

    valid.push({ vendor, category, amount, incurredOn, status, paidOn, notes: null });
  }

  return { valid, errors };
}

function matchCategory(value: string): BillCategory | null {
  const lower = value.toLowerCase();
  return BILL_CATEGORIES.find((category) => category.toLowerCase() === lower) ?? null;
}

function parseStrictDate(value: string): Date | null {
  if (!STRICT_DATE_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Reject e.g. "2026-02-30" silently rolling over into March.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** Splits raw CSV text into lines, respecting quoted fields that may contain embedded newlines. */
function splitCsvLines(csvText: string): string[] {
  const normalized = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of normalized) {
    if (char === '"') inQuotes = !inQuotes;
    if (char === "\n" && !inQuotes) {
      lines.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

/** Parses one CSV line into cells, supporting double-quoted fields with embedded commas and escaped "" quotes. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}
