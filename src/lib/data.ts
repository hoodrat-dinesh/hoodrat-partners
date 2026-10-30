import type { AuthContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type DatabaseError = { message: string } | null;

function ensureData(error: DatabaseError, message: string): void {
  if (error) throw new Error(`${message}: ${error.message}`);
}

function asNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function assertAdmin(context: AuthContext): void {
  if (
    context.profile.role !== "admin" ||
    context.profile.approval_status !== "approved"
  ) {
    throw new Error("Administrator context required");
  }
}

export interface SettingsData {
  brandName: string;
  logoUrl: string | null;
  tagline: string;
  supportEmail: string | null;
  primaryColor: string;
  accentColor: string;
  currency: string;
  payoutThresholdMinor: number;
  defaultDiscountPercent: number;
}

export const defaultSettings: SettingsData = {
  brandName: "Common Thread",
  logoUrl: null,
  tagline: "Partnership, made measurable.",
  supportEmail: null,
  primaryColor: "#000000",
  accentColor: "#666666",
  currency: "INR",
  payoutThresholdMinor: 200_000,
  defaultDiscountPercent: 10,
};

interface SettingsRow {
  brand_name: string;
  logo_url: string | null;
  tagline: string;
  support_email: string | null;
  primary_color: string;
  accent_color: string;
  currency: string;
  payout_threshold_minor: number;
  default_discount_percent: number;
}

function mapSettings(row: SettingsRow): SettingsData {
  return {
    brandName: row.brand_name,
    logoUrl: row.logo_url,
    tagline: row.tagline,
    supportEmail: row.support_email,
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    currency: row.currency,
    payoutThresholdMinor: asNumber(row.payout_threshold_minor),
    defaultDiscountPercent: asNumber(row.default_discount_percent),
  };
}

export async function getSettings(): Promise<SettingsData> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select(
      "brand_name, logo_url, tagline, support_email, primary_color, accent_color, currency, payout_threshold_minor, default_discount_percent",
    )
    .eq("id", 1)
    .single();
  ensureData(error, "Unable to load settings");
  return mapSettings(data as unknown as SettingsRow);
}

export async function getPublicSettings(): Promise<SettingsData> {
  try {
    return await getSettings();
  } catch {
    return defaultSettings;
  }
}

export interface BalanceData {
  balanceMinor: number;
  availableMinor: number;
  pendingPayoutMinor: number;
  lifetimeEarnedMinor: number;
  refundedMinor: number;
  paidMinor: number;
  totalCommissionMinor: number;
  currency: string;
}

interface BalanceRow {
  balance_minor: number;
  available_minor: number;
  pending_payout_minor: number;
  lifetime_earned_minor: number;
  refunded_minor: number;
  paid_minor: number;
  total_commission_minor: number;
  currency: string;
}

function emptyBalance(currency: string): BalanceData {
  return {
    balanceMinor: 0,
    availableMinor: 0,
    pendingPayoutMinor: 0,
    lifetimeEarnedMinor: 0,
    refundedMinor: 0,
    paidMinor: 0,
    totalCommissionMinor: 0,
    currency,
  };
}

function mapBalance(row: BalanceRow | null, currency: string): BalanceData {
  if (!row) return emptyBalance(currency);
  return {
    balanceMinor: asNumber(row.balance_minor),
    availableMinor: asNumber(row.available_minor),
    pendingPayoutMinor: asNumber(row.pending_payout_minor),
    lifetimeEarnedMinor: asNumber(row.lifetime_earned_minor),
    refundedMinor: asNumber(row.refunded_minor),
    paidMinor: asNumber(row.paid_minor),
    totalCommissionMinor: asNumber(row.total_commission_minor),
    currency: row.currency,
  };
}

export interface OrderData {
  id: string;
  reference: string;
  paidAt: string;
  products: string;
  revenueMinor: number;
  commissionMinor: number;
  currency: string;
  status: string;
  influencerName?: string;
  discountCode: string;
}

interface OrderRow {
  id: string;
  shopify_order_id: string;
  paid_at: string;
  attributed_revenue_minor: number;
  commission_minor: number;
  currency: string;
  status: string;
  discount_code: string;
  attributed_order_lines?: Array<{ title: string; quantity: number }>;
  profiles?: { full_name: string | null };
}

function mapOrder(row: OrderRow): OrderData {
  const products =
    row.attributed_order_lines
      ?.map((line) => `${line.title} × ${line.quantity}`)
      .join(", ") || "Assigned product";
  return {
    id: row.id,
    reference: `#${row.shopify_order_id}`,
    paidAt: row.paid_at,
    products,
    revenueMinor: asNumber(row.attributed_revenue_minor),
    commissionMinor: asNumber(row.commission_minor),
    currency: row.currency,
    status: row.status,
    influencerName: row.profiles?.full_name ?? undefined,
    discountCode: row.discount_code,
  };
}

async function loadInfluencerOrders(
  userId: string,
  limit?: number,
): Promise<OrderData[]> {
  const supabase = await createClient();
  let query = supabase
    .from("attributed_orders")
    .select(
      "id, shopify_order_id, paid_at, attributed_revenue_minor, commission_minor, currency, status, discount_code, attributed_order_lines(title, quantity)",
    )
    .eq("influencer_id", userId)
    .order("paid_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  ensureData(error, "Unable to load attributed orders");
  return ((data ?? []) as unknown as OrderRow[]).map(mapOrder);
}

async function loadInfluencerBalance(
  userId: string,
  currency: string,
): Promise<BalanceData> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("influencer_balances")
    .select(
      "balance_minor, available_minor, pending_payout_minor, lifetime_earned_minor, refunded_minor, paid_minor, total_commission_minor, currency",
    )
    .eq("influencer_id", userId)
    .maybeSingle();
  ensureData(error, "Unable to load earnings balance");
  return mapBalance(data as unknown as BalanceRow | null, currency);
}

export async function getInfluencerOverview(userId: string) {
  const settings = await getSettings();
  const supabase = await createClient();
  const [balance, orders, promotionResult] = await Promise.all([
    loadInfluencerBalance(userId, settings.currency),
    loadInfluencerOrders(userId, 5),
    supabase
      .from("promotions")
      .select("code")
      .eq("influencer_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  ensureData(promotionResult.error, "Unable to load promotion");
  return {
    settings,
    balance,
    orders,
    promotionCode:
      (promotionResult.data as unknown as { code: string } | null)?.code ??
      null,
  };
}

export async function getInfluencerOrders(userId: string) {
  return loadInfluencerOrders(userId);
}

export interface ProductAssignmentData {
  id: string;
  name: string;
  imageUrl: string | null;
  priceMinor: number;
  currency: string;
  discountPercent: number;
  commissionPercent: number;
  basis: string;
  potentialEarningMinor: number;
  url: string;
}

interface AssignmentRow {
  commission_percent: number;
  commission_basis: string;
  cost_basis_minor: number | null;
  promotions: { discount_percent: number };
  products: {
    id: string;
    title: string;
    image_url: string | null;
    price_minor: number;
    cost_minor: number | null;
    currency: string;
    product_url: string;
  };
}

export async function getInfluencerProducts(
  userId: string,
): Promise<ProductAssignmentData[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promotion_products")
    .select(
      "commission_percent, commission_basis, cost_basis_minor, promotions!inner(discount_percent, influencer_id, status), products!inner(id, title, image_url, price_minor, cost_minor, currency, product_url, active)",
    )
    .eq("promotions.influencer_id", userId)
    .eq("promotions.status", "active")
    .eq("products.active", true);
  ensureData(error, "Unable to load assigned products");
  return ((data ?? []) as unknown as AssignmentRow[]).map((row) => {
    const price = asNumber(row.products.price_minor);
    const discounted = Math.round(
      price * (1 - asNumber(row.promotions.discount_percent) / 100),
    );
    const basis =
      row.commission_basis === "gross_margin"
        ? Math.max(
            discounted -
              asNumber(row.cost_basis_minor ?? row.products.cost_minor),
            0,
          )
        : discounted;
    return {
      id: row.products.id,
      name: row.products.title,
      imageUrl: row.products.image_url,
      priceMinor: price,
      currency: row.products.currency,
      discountPercent: asNumber(row.promotions.discount_percent),
      commissionPercent: asNumber(row.commission_percent),
      basis: row.commission_basis,
      potentialEarningMinor: Math.round(
        basis * (asNumber(row.commission_percent) / 100),
      ),
      url: row.products.product_url,
    };
  });
}

export interface PayoutData {
  id: string;
  amountMinor: number;
  currency: string;
  status: string;
  requestedAt: string;
  recordedAt: string | null;
  reference: string | null;
  notes: string | null;
  influencerName?: string;
  upiPayoutId?: string | null;
}

interface PayoutRow {
  id: string;
  amount_minor: number;
  currency: string;
  status: string;
  requested_at: string;
  recorded_at: string | null;
  payout_reference: string | null;
  notes: string | null;
  profiles?: { full_name: string | null; upi_payout_id: string | null };
}

function mapPayout(row: PayoutRow): PayoutData {
  return {
    id: row.id,
    amountMinor: asNumber(row.amount_minor),
    currency: row.currency,
    status: row.status,
    requestedAt: row.requested_at,
    recordedAt: row.recorded_at,
    reference: row.payout_reference,
    notes: row.notes,
    influencerName: row.profiles?.full_name ?? undefined,
    upiPayoutId: row.profiles?.upi_payout_id,
  };
}

export async function getInfluencerPayouts(userId: string) {
  const settings = await getSettings();
  const supabase = await createClient();
  const [balance, payoutResult] = await Promise.all([
    loadInfluencerBalance(userId, settings.currency),
    supabase
      .from("payout_requests")
      .select(
        "id, amount_minor, currency, status, requested_at, recorded_at, payout_reference, notes",
      )
      .eq("influencer_id", userId)
      .order("requested_at", { ascending: false }),
  ]);
  ensureData(payoutResult.error, "Unable to load payouts");
  return {
    settings,
    balance,
    payouts: ((payoutResult.data ?? []) as unknown as PayoutRow[]).map(
      mapPayout,
    ),
  };
}

export interface AdminUserData {
  id: string;
  name: string;
  email: string | null;
  handle: string | null;
  followerCount: number;
  status: string;
  joinedAt: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  instagram_handle: string | null;
  follower_count: number | null;
  approval_status: string;
  created_at: string;
}

export async function getAdminUsers(
  context: AuthContext,
): Promise<AdminUserData[]> {
  assertAdmin(context);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, full_name, email, instagram_handle, follower_count, approval_status, created_at",
    )
    .eq("role", "influencer")
    .order("created_at", { ascending: false });
  ensureData(error, "Unable to load influencers");
  return ((data ?? []) as unknown as ProfileRow[]).map((row) => ({
    id: row.id,
    name: row.full_name || "Unnamed partner",
    email: row.email,
    handle: row.instagram_handle,
    followerCount: asNumber(row.follower_count),
    status: row.approval_status,
    joinedAt: row.created_at,
  }));
}

export interface AdminProductData {
  id: string;
  title: string;
  costMinor: number | null;
  currency: string;
}

export interface ProgramData {
  id: string;
  influencerName: string;
  code: string;
  discountPercent: number;
  status: string;
  products: Array<{
    name: string;
    commissionPercent: number;
    basis: string;
  }>;
}

interface ProgramRow {
  id: string;
  code: string;
  discount_percent: number;
  status: string;
  profiles: { full_name: string | null };
  promotion_products: Array<{
    commission_percent: number;
    commission_basis: string;
    products: { title: string };
  }>;
}

export async function getAdminPrograms(context: AuthContext) {
  assertAdmin(context);
  const admin = createAdminClient();
  const [users, productsResult, programsResult] = await Promise.all([
    getAdminUsers(context),
    admin
      .from("products")
      .select("id, title, cost_minor, currency")
      .eq("active", true)
      .order("title"),
    admin
      .from("promotions")
      .select(
        "id, code, discount_percent, status, profiles!promotions_influencer_id_fkey(full_name), promotion_products(commission_percent, commission_basis, products(title))",
      )
      .order("created_at", { ascending: false }),
  ]);
  ensureData(productsResult.error, "Unable to load products");
  ensureData(programsResult.error, "Unable to load promotions");
  return {
    influencers: users
      .filter((user) => user.status === "approved")
      .map((user) => ({ id: user.id, name: user.name })),
    products: (
      (productsResult.data ?? []) as unknown as Array<{
        id: string;
        title: string;
        cost_minor: number | null;
        currency: string;
      }>
    ).map((product) => ({
      id: product.id,
      title: product.title,
      costMinor:
        product.cost_minor === null ? null : asNumber(product.cost_minor),
      currency: product.currency,
    })),
    programs: ((programsResult.data ?? []) as unknown as ProgramRow[]).map(
      (row) => ({
        id: row.id,
        influencerName: row.profiles.full_name || "Unnamed partner",
        code: row.code,
        discountPercent: asNumber(row.discount_percent),
        status: row.status,
        products: row.promotion_products.map((assignment) => ({
          name: assignment.products.title,
          commissionPercent: asNumber(assignment.commission_percent),
          basis: assignment.commission_basis,
        })),
      }),
    ) satisfies ProgramData[],
  };
}

export async function getAdminOrders(
  context: AuthContext,
): Promise<OrderData[]> {
  assertAdmin(context);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("attributed_orders")
    .select(
      "id, shopify_order_id, paid_at, attributed_revenue_minor, commission_minor, currency, status, discount_code, attributed_order_lines(title, quantity), profiles!attributed_orders_influencer_id_fkey(full_name)",
    )
    .order("paid_at", { ascending: false });
  ensureData(error, "Unable to load attributed orders");
  return ((data ?? []) as unknown as OrderRow[]).map(mapOrder);
}

export async function getAdminPayouts(context: AuthContext) {
  assertAdmin(context);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payout_requests")
    .select(
      "id, amount_minor, currency, status, requested_at, recorded_at, payout_reference, notes, profiles!payout_requests_influencer_id_fkey(full_name, upi_payout_id)",
    )
    .order("requested_at", { ascending: false });
  ensureData(error, "Unable to load payout requests");
  return ((data ?? []) as unknown as PayoutRow[]).map(mapPayout);
}

export async function getAdminSettings(
  context: AuthContext,
): Promise<SettingsData> {
  assertAdmin(context);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_settings")
    .select(
      "brand_name, logo_url, tagline, support_email, primary_color, accent_color, currency, payout_threshold_minor, default_discount_percent",
    )
    .eq("id", 1)
    .single();
  ensureData(error, "Unable to load settings");
  return mapSettings(data as unknown as SettingsRow);
}

export async function getAdminOverview(context: AuthContext) {
  assertAdmin(context);
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [ordersResult, usersResult, balancesResult, activityResult] =
    await Promise.all([
      admin
        .from("attributed_orders")
        .select("attributed_revenue_minor")
        .gte("paid_at", since),
      admin.from("profiles").select("approval_status").eq("role", "influencer"),
      admin.from("influencer_balances").select("balance_minor, currency"),
      admin
        .from("audit_log")
        .select("id, action, entity_type, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
  ensureData(ordersResult.error, "Unable to load order metrics");
  ensureData(usersResult.error, "Unable to load partner metrics");
  ensureData(balancesResult.error, "Unable to load commission metrics");
  ensureData(activityResult.error, "Unable to load activity");

  const orders = (ordersResult.data ?? []) as unknown as Array<{
    attributed_revenue_minor: number;
  }>;
  const users = (usersResult.data ?? []) as unknown as Array<{
    approval_status: string;
  }>;
  const balances = (balancesResult.data ?? []) as unknown as Array<{
    balance_minor: number;
    currency: string;
  }>;
  return {
    attributedRevenueMinor: orders.reduce(
      (total, row) => total + asNumber(row.attributed_revenue_minor),
      0,
    ),
    commissionOwedMinor: balances.reduce(
      (total, row) => total + asNumber(row.balance_minor),
      0,
    ),
    currency: balances[0]?.currency ?? "INR",
    activePartners: users.filter(
      (user) => user.approval_status === "approved",
    ).length,
    pendingPartners: users.filter(
      (user) => user.approval_status === "pending",
    ).length,
    orderCount: orders.length,
    activity: (
      (activityResult.data ?? []) as unknown as Array<{
        id: number;
        action: string;
        entity_type: string;
        created_at: string;
      }>
    ).map((item) => ({
      id: item.id,
      action: item.action.replaceAll(".", " "),
      type: item.entity_type,
      createdAt: item.created_at,
    })),
  };
}
