/**
 * Vendor tagging conventions for the Shopify → offhrs workshop feed.
 *
 * Product must include tag OFFHRS_WORKSHOP_TAG.
 * Session start: metafield namespace OFFHRS_METAFIELD_NAMESPACE, key starts_at
 *   (ISO 8601 or America/Toronto local datetime). Prefer variant-level; fall back to product.
 * Optional metafields (same namespace):
 *   book_url          — override storefront URL
 *   capacity          — max seats (else inventory quantity)
 *   duration_minutes  — integer
 *   category          — offhrs category label (else "Other")
 * Inventory quantity on the variant = remaining seats (available_slots).
 * One variant per session date when a product has multiple dates.
 */

export const OFFHRS_WORKSHOP_TAG = 'offhrs_workshop'
export const OFFHRS_METAFIELD_NAMESPACE = 'offhrs'
export const OFFHRS_METAFIELD_STARTS_AT = 'starts_at'
export const OFFHRS_METAFIELD_BOOK_URL = 'book_url'
export const OFFHRS_METAFIELD_CAPACITY = 'capacity'
export const OFFHRS_METAFIELD_DURATION = 'duration_minutes'
export const OFFHRS_METAFIELD_CATEGORY = 'category'

export const SHOPIFY_API_VERSION = '2024-10'

export const SHOPIFY_OAUTH_SCOPES_DEFAULT = 'read_products,read_inventory'
