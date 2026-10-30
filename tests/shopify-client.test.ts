import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getShopifyAccessToken,
  resetShopifyTokenCache,
} from "@/lib/shopify/client";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.SHOPIFY_STORE_DOMAIN = "test-store.myshopify.com";
  process.env.SHOPIFY_CLIENT_ID = "client-id";
  process.env.SHOPIFY_CLIENT_SECRET = "client-secret";
  process.env.SHOPIFY_API_VERSION = "2026-10";
  resetShopifyTokenCache();
});

afterEach(() => {
  process.env = { ...originalEnv };
  resetShopifyTokenCache();
  vi.restoreAllMocks();
});

describe("Shopify client-credentials tokens", () => {
  it("exchanges credentials using the required form contract", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({ access_token: "shpat_test", expires_in: 86_400 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    await expect(getShopifyAccessToken(fetcher)).resolves.toBe("shpat_test");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetcher).mock.calls[0];
    expect(url).toBe(
      "https://test-store.myshopify.com/admin/oauth/access_token",
    );
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toContain("grant_type=client_credentials");
    expect(String(init?.body)).toContain("client_id=client-id");
    expect(String(init?.body)).toContain("client_secret=client-secret");
  });

  it("reuses a token while it is safely before expiry", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({ access_token: "cached-token", expires_in: 3_600 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    expect(await getShopifyAccessToken(fetcher)).toBe("cached-token");
    expect(await getShopifyAccessToken(fetcher)).toBe("cached-token");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
