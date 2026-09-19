import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(getApp(), 'us-west2');

export interface ShopifyOAuthStatus {
  connected: boolean;
  shopName: string | null;
  shopDomain: string | null;
  currency: string | null;
  abandonedCartMinutes: number;
  webhookFailures: string[];
}

/** Step 1: validate the shop domain server side and get the authorize URL. */
export async function startShopifyOAuth(
  workspaceId: string,
  shop: string,
  returnTo?: string,
): Promise<string> {
  const fn = httpsCallable<
    { workspaceId: string; shop: string; returnTo?: string },
    { url: string }
  >(functions, 'shopifyOAuthStart');
  const res = await fn({ workspaceId, shop, returnTo });
  return res.data.url;
}

export async function getShopifyOAuthStatus(
  workspaceId: string,
): Promise<ShopifyOAuthStatus> {
  const fn = httpsCallable<{ workspaceId: string }, ShopifyOAuthStatus>(
    functions,
    'shopifyOAuthStatus',
  );
  const res = await fn({ workspaceId });
  return res.data;
}

/** Update the abandoned cart window (minutes). */
export async function updateShopifySettings(
  workspaceId: string,
  abandonedCartMinutes: number,
): Promise<ShopifyOAuthStatus> {
  const fn = httpsCallable<
    { workspaceId: string; action: string; abandonedCartMinutes: number },
    ShopifyOAuthStatus
  >(functions, 'shopifyOAuthStatus');
  const res = await fn({ workspaceId, action: 'updateSettings', abandonedCartMinutes });
  return res.data;
}

/** Disconnect the store: webhooks removed, token disabled. */
export async function disconnectShopify(workspaceId: string): Promise<ShopifyOAuthStatus> {
  const fn = httpsCallable<{ workspaceId: string; action: string }, ShopifyOAuthStatus>(
    functions,
    'shopifyOAuthStatus',
  );
  const res = await fn({ workspaceId, action: 'disconnect' });
  return res.data;
}

/** Variables available for personalization in Shopify commerce messages. */
export const SHOPIFY_VARIABLES: Record<string, string[]> = {
  shopify_cart_abandoned: [
    'cart_total',
    'cart_currency',
    'cart_item_count',
    'cart_items',
    'cart_recovery_url',
    'customer_first_name',
    'customer_email',
  ],
  shopify_order_created: [
    'order_name',
    'order_total',
    'order_currency',
    'order_item_count',
    'order_items',
    'order_status_url',
    'customer_first_name',
    'customer_email',
  ],
  shopify_order_shipped: [
    'order_name',
    'tracking_number',
    'tracking_company',
    'tracking_url',
    'customer_first_name',
    'customer_email',
  ],
  shopify_order_delivered: [
    'order_name',
    'customer_first_name',
    'customer_email',
  ],
  shopify_product_purchased: [
    'product_title',
    'variant_title',
    'quantity',
    'price',
    'order_name',
    'customer_first_name',
    'customer_email',
  ],
};
