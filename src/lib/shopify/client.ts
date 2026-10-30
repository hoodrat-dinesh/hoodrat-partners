import { ApiError } from "@/lib/api";
import { getShopifyEnv } from "@/lib/env";

interface GraphqlEnvelope<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface TokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
}

let cachedToken:
  | { identity: string; accessToken: string; expiresAt: number }
  | undefined;

export function resetShopifyTokenCache(): void {
  cachedToken = undefined;
}

export async function getShopifyAccessToken(
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const env = getShopifyEnv();
  const identity = `${env.SHOPIFY_STORE_DOMAIN}:${env.SHOPIFY_CLIENT_ID}`;
  if (
    cachedToken?.identity === identity &&
    cachedToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedToken.accessToken;
  }
  const response = await fetcher(
    `https://${env.SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.SHOPIFY_CLIENT_ID,
        client_secret: env.SHOPIFY_CLIENT_SECRET,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new ApiError(`Shopify token exchange returned ${response.status}`, 502);
  }
  const payload = (await response.json()) as TokenResponse;
  const expiresIn = Number(payload.expires_in);
  if (
    typeof payload.access_token !== "string" ||
    !payload.access_token ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new ApiError("Shopify token exchange returned invalid data", 502);
  }
  cachedToken = {
    identity,
    accessToken: payload.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return cachedToken.accessToken;
}

interface ProductNode {
  id: string;
  legacyResourceId: string;
  title: string;
  handle: string;
  onlineStoreUrl: string | null;
  featuredImage: { url: string } | null;
  variants: {
    nodes: Array<{
      id: string;
      price: string;
      inventoryItem: { unitCost: { amount: string } | null };
    }>;
  };
}

interface ProductsData {
  shop: { currencyCode: string };
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: ProductNode[];
  };
}

export interface SyncedProduct {
  shopify_product_id: string;
  shopify_product_gid: string;
  shopify_variant_gid: string | null;
  title: string;
  handle: string;
  product_url: string;
  image_url: string | null;
  price_minor: number;
  cost_minor: number | null;
  currency: string;
  active: boolean;
  synced_at: string;
}

function moneyToMinor(amount: string): number {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ApiError(`Invalid Shopify money amount: ${amount}`, 502);
  }
  return Math.round(parsed * 100);
}

export async function shopifyGraphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const env = getShopifyEnv();
  const accessToken = await getShopifyAccessToken();
  const response = await fetch(
    `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new ApiError(`Shopify Admin API returned ${response.status}`, 502);
  }
  const envelope = (await response.json()) as GraphqlEnvelope<T>;
  if (envelope.errors?.length || !envelope.data) {
    throw new ApiError(
      envelope.errors?.map((error) => error.message).join("; ") ??
        "Shopify returned no data",
      502,
    );
  }
  return envelope.data;
}

export async function fetchAllProducts(): Promise<SyncedProduct[]> {
  const query = `#graphql
    query Products($after: String) {
      shop { currencyCode }
      products(first: 100, after: $after, query: "status:active") {
        pageInfo { hasNextPage endCursor }
        nodes {
          id legacyResourceId title handle onlineStoreUrl
          featuredImage { url }
          variants(first: 1) {
            nodes {
              id price
              inventoryItem { unitCost { amount } }
            }
          }
        }
      }
    }`;
  const products: SyncedProduct[] = [];
  let after: string | null = null;

  do {
    const data: ProductsData = await shopifyGraphql<ProductsData>(query, { after });
    for (const product of data.products.nodes) {
      const variant = product.variants.nodes[0];
      products.push({
        shopify_product_id: product.legacyResourceId,
        shopify_product_gid: product.id,
        shopify_variant_gid: variant?.id ?? null,
        title: product.title,
        handle: product.handle,
        product_url:
          product.onlineStoreUrl ??
          `https://${getShopifyEnv().SHOPIFY_STORE_DOMAIN}/products/${product.handle}`,
        image_url: product.featuredImage?.url ?? null,
        price_minor: variant ? moneyToMinor(variant.price) : 0,
        cost_minor: variant?.inventoryItem.unitCost
          ? moneyToMinor(variant.inventoryItem.unitCost.amount)
          : null,
        currency: data.shop.currencyCode.toUpperCase(),
        active: true,
        synced_at: new Date().toISOString(),
      });
    }
    after = data.products.pageInfo.hasNextPage
      ? data.products.pageInfo.endCursor
      : null;
  } while (after);

  return products;
}

interface DiscountMutationData {
  discountCodeBasicCreate: {
    codeDiscountNode: { id: string } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

export async function createShopifyDiscount(input: {
  code: string;
  percentage: number;
  productGids: string[];
  startsAt?: string | null;
  endsAt?: string | null;
}): Promise<string> {
  const mutation = `#graphql
    mutation CreateDiscount($discount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $discount) {
        codeDiscountNode { id }
        userErrors { field message }
      }
    }`;
  const data = await shopifyGraphql<DiscountMutationData>(mutation, {
    discount: {
      title: `Influencer ${input.code}`,
      code: input.code,
      startsAt: input.startsAt ?? new Date().toISOString(),
      endsAt: input.endsAt ?? null,
      customerSelection: { all: true },
      customerGets: {
        value: { percentage: input.percentage / 100 },
        items: { products: { productsToAdd: input.productGids } },
      },
      appliesOncePerCustomer: false,
    },
  });
  const result = data.discountCodeBasicCreate;
  if (result.userErrors.length || !result.codeDiscountNode) {
    throw new ApiError(
      result.userErrors.map((error) => error.message).join("; ") ||
        "Shopify did not create the discount",
      422,
    );
  }
  return result.codeDiscountNode.id;
}

interface DiscountUpdateData {
  discountCodeBasicUpdate: {
    codeDiscountNode: { id: string } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

export async function updateShopifyDiscount(
  discountId: string,
  input: {
    code?: string;
    percentage?: number;
    productsToAdd?: string[];
    productsToRemove?: string[];
    startsAt?: string | null;
    endsAt?: string | null;
  },
): Promise<void> {
  const discount: Record<string, unknown> = {};
  if (input.code) discount.code = input.code;
  if (input.percentage !== undefined) {
    discount.customerGets = {
      value: { percentage: input.percentage / 100 },
      ...(input.productsToAdd || input.productsToRemove
        ? {
            items: {
              products: {
                productsToAdd: input.productsToAdd ?? [],
                productsToRemove: input.productsToRemove ?? [],
              },
            },
          }
        : {}),
    };
  } else if (input.productsToAdd || input.productsToRemove) {
    discount.customerGets = {
      items: {
        products: {
          productsToAdd: input.productsToAdd ?? [],
          productsToRemove: input.productsToRemove ?? [],
        },
      },
    };
  }
  if (input.startsAt !== undefined) discount.startsAt = input.startsAt;
  if (input.endsAt !== undefined) discount.endsAt = input.endsAt;

  const mutation = `#graphql
    mutation UpdateDiscount($id: ID!, $discount: DiscountCodeBasicInput!) {
      discountCodeBasicUpdate(id: $id, basicCodeDiscount: $discount) {
        codeDiscountNode { id }
        userErrors { field message }
      }
    }`;
  const data = await shopifyGraphql<DiscountUpdateData>(mutation, {
    id: discountId,
    discount,
  });
  const result = data.discountCodeBasicUpdate;
  if (result.userErrors.length || !result.codeDiscountNode) {
    throw new ApiError(
      result.userErrors.map((error) => error.message).join("; ") ||
        "Shopify did not update the discount",
      422,
    );
  }
}

interface DiscountStatusData {
  discountCodeActivate?: {
    codeDiscountNode: { id: string } | null;
    userErrors: Array<{ message: string }>;
  };
  discountCodeDeactivate?: {
    codeDiscountNode: { id: string } | null;
    userErrors: Array<{ message: string }>;
  };
}

export async function setShopifyDiscountActive(
  discountId: string,
  active: boolean,
): Promise<void> {
  const field = active ? "discountCodeActivate" : "discountCodeDeactivate";
  const mutation = `#graphql
    mutation SetDiscountStatus($id: ID!) {
      ${field}(id: $id) {
        codeDiscountNode { id }
        userErrors { message }
      }
    }`;
  const data = await shopifyGraphql<DiscountStatusData>(mutation, {
    id: discountId,
  });
  const result = data[field];
  if (!result || result.userErrors.length || !result.codeDiscountNode) {
    throw new ApiError(
      result?.userErrors.map((error) => error.message).join("; ") ||
        "Shopify did not change discount status",
      422,
    );
  }
}

interface WebhookMutationData {
  webhookSubscriptionCreate: {
    webhookSubscription: { id: string } | null;
    userErrors: Array<{ message: string }>;
  };
}

export type WebhookTopic =
  | "ORDERS_PAID"
  | "REFUNDS_CREATE"
  | "ORDERS_CANCELLED";

const webhookIncludeFields: Record<WebhookTopic, string[]> = {
  ORDERS_PAID: [
    "id",
    "admin_graphql_api_id",
    "currency",
    "discount_codes.code",
    "line_items.id",
    "line_items.product_id",
    "line_items.title",
    "line_items.quantity",
    "line_items.price",
    "line_items.total_discount",
  ],
  ORDERS_CANCELLED: ["id", "cancelled_at"],
  REFUNDS_CREATE: [
    "id",
    "order_id",
    "refund_line_items.id",
    "refund_line_items.line_item_id",
    "refund_line_items.quantity",
  ],
};

export function webhookFieldsForTopic(topic: WebhookTopic): string[] {
  return [...webhookIncludeFields[topic]];
}

interface WebhookListData {
  webhookSubscriptions: {
    nodes: Array<{
      id: string;
      topic: WebhookTopic;
      uri: string;
      includeFields: string[];
    }>;
  };
}

export async function listWebhookSubscriptions(
  topics: WebhookTopic[],
): Promise<WebhookListData["webhookSubscriptions"]["nodes"]> {
  const query = `#graphql
    query Webhooks($topics: [WebhookSubscriptionTopic!]) {
      webhookSubscriptions(first: 100, topics: $topics) {
        nodes {
          id
          topic
          uri
          includeFields
        }
      }
    }`;
  const data = await shopifyGraphql<WebhookListData>(query, { topics });
  return data.webhookSubscriptions.nodes;
}

export async function createWebhookSubscription(
  topic: WebhookTopic,
  uri: string,
): Promise<string> {
  const mutation = `#graphql
    mutation WebhookCreate($topic: WebhookSubscriptionTopic!, $webhook: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhook) {
        webhookSubscription { id }
        userErrors { message }
      }
    }`;
  const data = await shopifyGraphql<WebhookMutationData>(mutation, {
    topic,
    webhook: {
      uri,
      format: "JSON",
      includeFields: webhookIncludeFields[topic],
    },
  });
  const result = data.webhookSubscriptionCreate;
  if (result.userErrors.length || !result.webhookSubscription) {
    throw new ApiError(
      result.userErrors.map((error) => error.message).join("; ") ||
        `Unable to subscribe to ${topic}`,
      422,
    );
  }
  return result.webhookSubscription.id;
}

interface WebhookUpdateData {
  webhookSubscriptionUpdate: {
    webhookSubscription: { id: string } | null;
    userErrors: Array<{ message: string }>;
  };
}

export async function updateWebhookSubscription(
  id: string,
  topic: WebhookTopic,
  uri: string,
): Promise<void> {
  const mutation = `#graphql
    mutation WebhookUpdate($id: ID!, $webhook: WebhookSubscriptionInput!) {
      webhookSubscriptionUpdate(id: $id, webhookSubscription: $webhook) {
        webhookSubscription { id }
        userErrors { message }
      }
    }`;
  const data = await shopifyGraphql<WebhookUpdateData>(mutation, {
    id,
    webhook: {
      uri,
      format: "JSON",
      includeFields: webhookIncludeFields[topic],
    },
  });
  const result = data.webhookSubscriptionUpdate;
  if (result.userErrors.length || !result.webhookSubscription) {
    throw new ApiError(
      result.userErrors.map((error) => error.message).join("; ") ||
        `Unable to update ${topic}`,
      422,
    );
  }
}
