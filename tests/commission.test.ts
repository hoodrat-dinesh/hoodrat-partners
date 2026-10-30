import { describe, expect, it } from "vitest";

import {
  calculateCommission,
  calculateRefundReversal,
  percentageOfMinorUnits,
  totalRefundedQuantity,
} from "@/lib/commission";

describe("commission accounting", () => {
  it("calculates net-revenue commission after the allocated discount", () => {
    expect(
      calculateCommission({
        unitPriceMinor: 100_000,
        quantity: 2,
        allocatedDiscountMinor: 20_000,
        commissionPercent: 15,
        basis: "net_revenue",
        costBasisMinor: 30_000,
      }),
    ).toEqual({
      netRevenueMinor: 180_000,
      commissionableMinor: 180_000,
      commissionMinor: 27_000,
    });
  });

  it("calculates gross-margin commission without allowing negative margin", () => {
    expect(
      calculateCommission({
        unitPriceMinor: 50_000,
        quantity: 2,
        allocatedDiscountMinor: 10_000,
        commissionPercent: 20,
        basis: "gross_margin",
        costBasisMinor: 30_000,
      }),
    ).toEqual({
      netRevenueMinor: 90_000,
      commissionableMinor: 30_000,
      commissionMinor: 6_000,
    });

    expect(
      calculateCommission({
        unitPriceMinor: 20_000,
        quantity: 1,
        allocatedDiscountMinor: 5_000,
        commissionPercent: 20,
        basis: "gross_margin",
        costBasisMinor: 25_000,
      }).commissionMinor,
    ).toBe(0);
  });

  it("rounds percentages to one minor unit", () => {
    expect(percentageOfMinorUnits(101, 10)).toBe(10);
    expect(percentageOfMinorUnits(105, 10)).toBe(11);
  });

  it("reverses partial refunds without exceeding original commission", () => {
    expect(calculateRefundReversal(1_001, 3, 1)).toBe(334);
    expect(calculateRefundReversal(1_001, 3, 2, 334)).toBe(333);
    expect(calculateRefundReversal(1_001, 3, 3, 667)).toBe(334);
    expect(calculateRefundReversal(1_001, 3, 4)).toBe(1_001);
  });

  it("totals only refunds for the requested Shopify line", () => {
    expect(
      totalRefundedQuantity(
        [
          { shopifyRefundLineId: "refund-1", shopifyLineId: "line-a", quantity: 1 },
          { shopifyRefundLineId: "refund-2", shopifyLineId: "line-b", quantity: 4 },
          { shopifyRefundLineId: "refund-3", shopifyLineId: "line-a", quantity: 2 },
        ],
        "line-a",
      ),
    ).toBe(3);
  });

  it("rejects unsafe or nonsensical financial inputs", () => {
    expect(() => percentageOfMinorUnits(-1, 10)).toThrow(RangeError);
    expect(() => percentageOfMinorUnits(100, 101)).toThrow(RangeError);
    expect(() =>
      calculateCommission({
        unitPriceMinor: 100,
        quantity: 0,
        allocatedDiscountMinor: 0,
        commissionPercent: 10,
        basis: "net_revenue",
      }),
    ).toThrow(RangeError);
  });
});
