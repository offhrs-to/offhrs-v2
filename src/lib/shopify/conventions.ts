/**
 * Vendor conventions for the Shopify → offhrs workshop feed.
 *
 * Publish (Phase 2): products published to the offhrs sales channel via Admin.
 * Legacy tag `offhrs_workshop` only applies when a channel connection is not yet created.
 *
 * Booking URL (Phase 3): guests land on a Shopify cart permalink
 * `/cart/{variantId}:1?access_token=…&source_name=channel:{handle}` so checkout
 * attributes to the offhrs channel. Product-page URLs are no longer the default.
 *
 * Session start (resolved automatically when possible):
 * 1. Optional metafield offhrs.starts_at (override)
 * 2. Variant selectedOptions — e.g. option name "Date" with value
 *    "August 21, 2026 12:00 PM" (Orris-style time-slot variants)
 * 3. Variant title / product title if they contain a parseable datetime
 * Naive times are interpreted as America/Toronto.
 *
 * Optional metafields (namespace offhrs): book_url (Shopify cart/checkout only —
 * off-Shopify URLs are ignored), capacity, duration_minutes, category
 * Category fallback: product/variant offhrs.category metafield → vendor primary signup
 * category (vendor_profiles.category[0]) → Other.
 * Inventory on the variant = remaining seats (available_slots).
 * One Shopify variant ≈ one offhrs session row.
 */

export const OFFHRS_WORKSHOP_TAG = 'offhrs_workshop'
export const OFFHRS_METAFIELD_NAMESPACE = 'offhrs'
export const OFFHRS_METAFIELD_STARTS_AT = 'starts_at'
export const OFFHRS_METAFIELD_BOOK_URL = 'book_url'
export const OFFHRS_METAFIELD_CAPACITY = 'capacity'
export const OFFHRS_METAFIELD_DURATION = 'duration_minutes'
export const OFFHRS_METAFIELD_CATEGORY = 'category'

export const SHOPIFY_API_VERSION = '2026-04'

/** Default OAuth scopes — keep in sync with shopify.app.toml [access_scopes].scopes */
export const SHOPIFY_OAUTH_SCOPES_DEFAULT =
  'read_products,read_inventory,read_product_listings,write_resource_feedbacks,unauthenticated_read_product_listings'

/** Channel config specification handle (extensions/channel-config/specifications/offhrs-ca.toml). */
export const OFFHRS_CHANNEL_SPEC_HANDLE = 'offhrs-ca'

/** Shopify Admin deep links for publishing UX. */
export function shopifyAdminProductsUrl(shopDomain: string): string {
  const handle = shopDomain.replace(/\.myshopify\.com$/i, '')
  return `https://admin.shopify.com/store/${handle}/products`
}

export function shopifyAdminBulkPublicationsUrl(shopDomain: string): string {
  const handle = shopDomain.replace(/\.myshopify\.com$/i, '')
  return `https://admin.shopify.com/store/${handle}/bulk?resource_name=Product&edit=publications`
}
