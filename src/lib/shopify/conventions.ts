/**
 * Vendor conventions for the Shopify → offhrs workshop feed.
 *
 * Required:
 * - Product tag: OFFHRS_WORKSHOP_TAG (`offhrs_workshop`)
 *
 * Session start (resolved automatically when possible):
 * 1. Optional metafield offhrs.starts_at (override)
 * 2. Variant selectedOptions — e.g. option name "Date" with value
 *    "August 21, 2026 12:00 PM" (Orris-style time-slot variants)
 * 3. Variant title / product title if they contain a parseable datetime
 * Naive times are interpreted as America/Toronto.
 *
 * Optional metafields (namespace offhrs): book_url, capacity, duration_minutes, category
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

export const SHOPIFY_API_VERSION = '2024-10'

export const SHOPIFY_OAUTH_SCOPES_DEFAULT = 'read_products,read_inventory'
