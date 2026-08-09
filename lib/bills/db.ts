import type { Bill } from "@prisma/client";
import { prisma } from "../db";
import { parseBillsCsv, type BillCsvRowError } from "./csv";
import type { BillInput, BillStatus } from "./types";

/**
 * The one place all Bill writes funnel through, so the status/paidOn
 * consistency rule (paid needs a date, unpaid must not have one) is
 * enforced regardless of caller -- same principle as the read-only trial
 * gate: don't trust the UI to have gotten it right.
 */
function assertPaidOnConsistency(input: BillInput): void {
  if (input.status === "paid" && !input.paidOn) {
    throw new TypeError('paidOn is required when status is "paid"');
  }
  if (input.status === "unpaid" && input.paidOn) {
    throw new TypeError('paidOn must be null when status is "unpaid"');
  }
}

export async function listBills(storeId: string, opts?: { status?: BillStatus }): Promise<Bill[]> {
  return prisma.bill.findMany({
    where: { storeId, ...(opts?.status ? { status: opts.status } : {}) },
    orderBy: { incurredOn: "desc" },
  });
}

export async function createBill(storeId: string, input: BillInput): Promise<Bill> {
  assertPaidOnConsistency(input);
  return prisma.bill.create({
    data: {
      storeId,
      vendor: input.vendor,
      category: input.category,
      amount: input.amount,
      incurredOn: input.incurredOn,
      status: input.status,
      paidOn: input.paidOn,
      notes: input.notes ?? null,
    },
  });
}

export async function updateBill(storeId: string, id: string, input: BillInput): Promise<Bill> {
  assertPaidOnConsistency(input);
  const existing = await prisma.bill.findFirst({ where: { id, storeId } });
  if (!existing) {
    throw new Error(`Bill ${id} not found for this store`);
  }
  return prisma.bill.update({
    where: { id },
    data: {
      vendor: input.vendor,
      category: input.category,
      amount: input.amount,
      incurredOn: input.incurredOn,
      status: input.status,
      paidOn: input.paidOn,
      notes: input.notes ?? null,
    },
  });
}

export async function deleteBill(storeId: string, id: string): Promise<void> {
  const existing = await prisma.bill.findFirst({ where: { id, storeId } });
  if (!existing) {
    throw new Error(`Bill ${id} not found for this store`);
  }
  await prisma.bill.delete({ where: { id } });
}

/** Partial import is intentional -- valid rows import even if other rows in the same file have errors. */
export async function importBillsCsv(storeId: string, csvText: string): Promise<{ imported: number; errors: BillCsvRowError[] }> {
  const { valid, errors } = parseBillsCsv(csvText);

  if (valid.length > 0) {
    await prisma.bill.createMany({
      data: valid.map((input) => ({
        storeId,
        vendor: input.vendor,
        category: input.category,
        amount: input.amount,
        incurredOn: input.incurredOn,
        status: input.status,
        paidOn: input.paidOn,
        notes: input.notes ?? null,
      })),
    });
  }

  return { imported: valid.length, errors };
}
