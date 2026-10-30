export type UserRole = "admin" | "influencer";
export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";
export type PromotionStatus = "draft" | "active" | "paused" | "archived";
export type CommissionBasis = "net_revenue" | "gross_margin";
export type LedgerEntryType =
  | "earn"
  | "refund"
  | "adjustment"
  | "payout";
export type PayoutStatus = "pending" | "paid" | "rejected" | "cancelled";

export interface Profile {
  id: string;
  email: string | null;
  role: UserRole;
  approvalStatus: ApprovalStatus;
  onboardingCompleted: boolean;
  fullName: string | null;
  instagramHandle: string | null;
  followerCount: number | null;
  upiPayoutId: string | null;
  rejectionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSettings {
  id: number;
  brandName: string;
  logoUrl: string | null;
  tagline: string;
  currency: string;
  payoutThresholdMinor: number;
  defaultDiscountPercent: number;
  primaryColor: string;
  accentColor: string;
  supportEmail: string | null;
  updatedAt: string;
}

export interface Product {
  id: string;
  shopifyProductId: string;
  shopifyProductGid: string;
  shopifyVariantGid: string | null;
  title: string;
  handle: string;
  productUrl: string;
  imageUrl: string | null;
  priceMinor: number;
  costMinor: number | null;
  currency: string;
  active: boolean;
  syncedAt: string;
}

export interface Promotion {
  id: string;
  code: string;
  influencerId: string;
  discountPercent: number;
  shopifyDiscountId: string | null;
  status: PromotionStatus;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionProduct {
  promotionId: string;
  productId: string;
  commissionPercent: number;
  commissionBasis: CommissionBasis;
  costBasisMinor: number | null;
}

export interface WebhookEvent {
  webhookDeliveryId: string;
  correlationId: string | null;
  topic: string;
  resourceKey: string | null;
  payloadSha256: string;
  status: "processing" | "processed" | "ignored";
  detail: string | null;
  receivedAt: string;
  processedAt: string | null;
}

export interface AttributedOrder {
  id: string;
  shopifyOrderId: string;
  shopifyOrderGid: string | null;
  promotionId: string;
  influencerId: string;
  discountCode: string;
  currency: string;
  attributedRevenueMinor: number;
  commissionMinor: number;
  status: "paid" | "partially_refunded" | "refunded" | "cancelled";
  paidAt: string;
  cancelledAt: string | null;
}

export interface AttributedOrderLine {
  id: string;
  attributedOrderId: string;
  shopifyLineId: string;
  productId: string;
  title: string;
  quantity: number;
  refundedQuantity: number;
  unitPriceMinor: number;
  discountMinor: number;
  netRevenueMinor: number;
  costBasisMinor: number;
  commissionBasis: CommissionBasis;
  commissionPercent: number;
  commissionMinor: number;
  reversedCommissionMinor: number;
}

export interface CommissionLedgerEntry {
  id: string;
  influencerId: string;
  entryType: LedgerEntryType;
  amountMinor: number;
  currency: string;
  attributedOrderId: string | null;
  attributedOrderLineId: string | null;
  payoutRequestId: string | null;
  sourceKey: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface PayoutRequest {
  id: string;
  influencerId: string;
  amountMinor: number;
  currency: string;
  status: PayoutStatus;
  payoutReference: string | null;
  notes: string | null;
  recordedBy: string | null;
  requestedAt: string;
  recordedAt: string | null;
}

export interface AuditLogEntry {
  id: number;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Money {
  amountMinor: number;
  currency: string;
}

export interface InfluencerBalance {
  balanceMinor: number;
  availableMinor: number;
  pendingPayoutMinor: number;
  lifetimeEarnedMinor: number;
  refundedMinor: number;
  paidMinor: number;
  totalCommissionMinor: number;
  currency: string;
}

export interface CommissionInput {
  unitPriceMinor: number;
  quantity: number;
  allocatedDiscountMinor: number;
  commissionPercent: number;
  basis: CommissionBasis;
  costBasisMinor?: number | null;
}

export interface CommissionResult {
  netRevenueMinor: number;
  commissionableMinor: number;
  commissionMinor: number;
}

export interface OrderLineInput {
  shopifyLineId: string;
  shopifyProductGid: string;
  title: string;
  quantity: number;
  unitPriceMinor: number;
  discountMinor: number;
}

export interface RefundLineInput {
  shopifyRefundLineId: string;
  shopifyLineId: string;
  quantity: number;
}
