import { z } from "zod";

const uuid = z.uuid();
const percent = z.number().finite().min(0).max(100);
const positiveMinor = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const profileFieldsSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  instagramHandle: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .regex(/^@?[A-Za-z0-9._]+$/)
    .transform((value) => value.replace(/^@/, "").toLowerCase()),
  followerCount: z.number().int().nonnegative().max(2_000_000_000),
  upiPayoutId: z
    .string()
    .trim()
    .max(120)
    .regex(/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/)
    .nullable()
    .optional(),
});

export const onboardingSchema = profileFieldsSchema.extend({
  acceptedTerms: z.literal(true),
});

export const profileSchema = profileFieldsSchema;

export const payoutRequestSchema = z.object({
  amountMinor: positiveMinor.positive(),
});

export const userStatusSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("approved"), notes: z.string().max(1000).optional() }),
  z.object({ status: z.literal("rejected"), notes: z.string().trim().min(1).max(1000) }),
  z.object({ status: z.literal("suspended"), notes: z.string().trim().min(1).max(1000) }),
]);

export const promotionProductSchema = z.object({
  productId: uuid,
  commissionPercent: percent,
  commissionBasis: z.enum(["net_revenue", "gross_margin"]),
  costBasisMinor: positiveMinor.nullable().optional(),
});

const promotionFieldsSchema = z.object({
  influencerId: uuid,
  code: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/).transform((v) => v.toUpperCase()),
  discountPercent: percent.positive(),
  status: z.enum(["draft", "active", "paused"]).default("draft"),
  startsAt: z.iso.datetime().nullable().optional(),
  endsAt: z.iso.datetime().nullable().optional(),
  products: z
    .array(promotionProductSchema)
    .min(1)
    .max(100)
    .refine(
      (products) =>
        new Set(products.map((product) => product.productId)).size ===
        products.length,
      { message: "Each product can be assigned only once" },
    ),
});

export const createPromotionSchema = promotionFieldsSchema.refine(
  (value) => !value.startsAt || !value.endsAt || value.endsAt > value.startsAt,
  { message: "endsAt must be after startsAt", path: ["endsAt"] },
);

export const updatePromotionSchema = promotionFieldsSchema
  .omit({ influencerId: true })
  .partial()
  .extend({
    code: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/).transform((v) => v.toUpperCase()).optional(),
    status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  })
  .refine(
    (value) => !value.startsAt || !value.endsAt || value.endsAt > value.startsAt,
    { message: "endsAt must be after startsAt", path: ["endsAt"] },
  );

export const recordPayoutSchema = z.object({
  reference: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const rejectPayoutSchema = z.object({
  notes: z.string().trim().min(1).max(1000),
});

export const settingsSchema = z.object({
  brandName: z.string().trim().min(1).max(100),
  logoUrl: z.url().nullable(),
  tagline: z.string().trim().max(200),
  currency: z.literal("INR"),
  payoutThresholdMinor: positiveMinor.positive(),
  defaultDiscountPercent: percent.positive(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  supportEmail: z.email().nullable(),
});
