import { describe, expect, it } from "vitest";

import {
  createPromotionSchema,
  onboardingSchema,
  payoutRequestSchema,
} from "@/lib/validation";

describe("request validation", () => {
  it("normalizes an Instagram handle and accepts a valid UPI ID", () => {
    const result = onboardingSchema.parse({
      fullName: "Aarav Mehta",
      instagramHandle: "@Aarav.Creates",
      followerCount: 42_500,
      upiPayoutId: "aarav@okbank",
      acceptedTerms: true,
    });

    expect(result.instagramHandle).toBe("aarav.creates");
    expect(result.followerCount).toBe(42_500);
  });

  it("rejects profile fields that are not valid for the product", () => {
    expect(() =>
      onboardingSchema.parse({
        fullName: "A",
        instagramHandle: "not a handle!",
        followerCount: -1,
        acceptedTerms: false,
      }),
    ).toThrow();
  });

  it("requires a positive integer payout amount", () => {
    expect(payoutRequestSchema.parse({ amountMinor: 200_000 })).toEqual({
      amountMinor: 200_000,
    });
    expect(() => payoutRequestSchema.parse({ amountMinor: 0 })).toThrow();
    expect(() => payoutRequestSchema.parse({ amountMinor: 1.5 })).toThrow();
  });

  it("normalizes promotion codes and validates product economics", () => {
    const productId = "5b82c784-75ce-4a8e-a993-7e879c796721";
    const influencerId = "a8b38d16-70eb-4d15-a0ea-c359ecbbb412";
    const result = createPromotionSchema.parse({
      influencerId,
      code: " aarav_10 ",
      discountPercent: 10,
      products: [
        {
          productId,
          commissionPercent: 15,
          commissionBasis: "gross_margin",
          costBasisMinor: 30_000,
        },
      ],
    });

    expect(result.code).toBe("AARAV_10");
    expect(result.status).toBe("draft");
  });

  it("rejects an end date before a promotion starts", () => {
    expect(() =>
      createPromotionSchema.parse({
        influencerId: "a8b38d16-70eb-4d15-a0ea-c359ecbbb412",
        code: "AARAV10",
        discountPercent: 10,
        startsAt: "2026-11-10T00:00:00.000Z",
        endsAt: "2026-11-01T00:00:00.000Z",
        products: [
          {
            productId: "5b82c784-75ce-4a8e-a993-7e879c796721",
            commissionPercent: 15,
            commissionBasis: "net_revenue",
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects duplicate product assignments in one promotion", () => {
    const productId = "5b82c784-75ce-4a8e-a993-7e879c796721";
    expect(() =>
      createPromotionSchema.parse({
        influencerId: "a8b38d16-70eb-4d15-a0ea-c359ecbbb412",
        code: "AARAV10",
        discountPercent: 10,
        products: [
          {
            productId,
            commissionPercent: 10,
            commissionBasis: "net_revenue",
          },
          {
            productId,
            commissionPercent: 15,
            commissionBasis: "gross_margin",
          },
        ],
      }),
    ).toThrow();
  });
});
