import type {
  CommissionInput,
  CommissionResult,
  RefundLineInput,
} from "@/lib/types";

function assertInteger(name: string, value: number, minimum = 0): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be a safe integer >= ${minimum}`);
  }
}

export function percentageOfMinorUnits(
  amountMinor: number,
  percent: number,
): number {
  assertInteger("amountMinor", amountMinor);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new RangeError("percent must be between 0 and 100");
  }
  return Math.round((amountMinor * percent) / 100);
}

export function calculateCommission(
  input: CommissionInput,
): CommissionResult {
  assertInteger("unitPriceMinor", input.unitPriceMinor);
  assertInteger("quantity", input.quantity, 1);
  assertInteger("allocatedDiscountMinor", input.allocatedDiscountMinor);

  const grossRevenue = input.unitPriceMinor * input.quantity;
  if (!Number.isSafeInteger(grossRevenue)) {
    throw new RangeError("line revenue exceeds safe integer range");
  }

  const netRevenueMinor = Math.max(
    grossRevenue - Math.min(input.allocatedDiscountMinor, grossRevenue),
    0,
  );
  const cost = input.costBasisMinor ?? 0;
  assertInteger("costBasisMinor", cost);

  const commissionableMinor =
    input.basis === "gross_margin"
      ? Math.max(netRevenueMinor - cost * input.quantity, 0)
      : netRevenueMinor;

  return {
    netRevenueMinor,
    commissionableMinor,
    commissionMinor: percentageOfMinorUnits(
      commissionableMinor,
      input.commissionPercent,
    ),
  };
}

export function calculateRefundReversal(
  originalCommissionMinor: number,
  originalQuantity: number,
  refundedQuantity: number,
  alreadyReversedMinor = 0,
): number {
  assertInteger("originalCommissionMinor", originalCommissionMinor);
  assertInteger("originalQuantity", originalQuantity, 1);
  assertInteger("refundedQuantity", refundedQuantity, 1);
  assertInteger("alreadyReversedMinor", alreadyReversedMinor);

  const target = Math.round(
    (originalCommissionMinor *
      Math.min(refundedQuantity, originalQuantity)) /
      originalQuantity,
  );
  return Math.max(
    Math.min(target - alreadyReversedMinor, originalCommissionMinor),
    0,
  );
}

export function totalRefundedQuantity(
  refunds: readonly RefundLineInput[],
  shopifyLineId: string,
): number {
  return refunds
    .filter((refund) => refund.shopifyLineId === shopifyLineId)
    .reduce((total, refund) => total + refund.quantity, 0);
}
