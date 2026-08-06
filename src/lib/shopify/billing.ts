import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PARTNER_TRIAL_DAYS,
  SHOPIFY_SYNC_MONTHLY_CAD,
  SHOPIFY_SYNC_PLAN_HANDLE,
  SHOPIFY_SYNC_PLAN_NAME,
} from '@/lib/partner-pricing'
import { shopifyAdminGraphql } from './admin-client'

type Admin = SupabaseClient

export type ShopifyBillingStatus =
  | 'none'
  | 'pending'
  | 'active'
  | 'cancelled'
  | 'declined'
  | 'expired'
  | 'frozen'

const CREATE_SUBSCRIPTION = `
  mutation AppSubscriptionCreate(
    $name: String!
    $returnUrl: URL!
    $test: Boolean
    $trialDays: Int
    $lineItems: [AppSubscriptionLineItemInput!]!
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      test: $test
      trialDays: $trialDays
      lineItems: $lineItems
    ) {
      confirmationUrl
      appSubscription {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`

const ACTIVE_SUBSCRIPTIONS = `
  query ActiveAppSubscriptions {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        test
        currentPeriodEnd
      }
    }
  }
`

const SUBSCRIPTION_BY_ID = `
  query AppSubscription($id: ID!) {
    node(id: $id) {
      ... on AppSubscription {
        id
        name
        status
        test
      }
    }
  }
`

/** App Store listing / Admin URL slug (shopify.app.toml `handle`). */
export function shopifyAppHandle(): string {
  return process.env.SHOPIFY_APP_HANDLE?.trim() || 'offhrs'
}

/**
 * Shopify-hosted App Pricing plan picker.
 * https://admin.shopify.com/store/{store}/charges/{appHandle}/pricing_plans
 */
export function shopifyAppPricingPlansUrl(shopDomain: string): string {
  const storeHandle = shopDomain.replace(/\.myshopify\.com$/i, '')
  return `https://admin.shopify.com/store/${storeHandle}/charges/${shopifyAppHandle()}/pricing_plans`
}

export function isShopifySyncPlanHandle(handle: string | null | undefined): boolean {
  if (!handle?.trim()) return false
  return handle.trim().toLowerCase() === SHOPIFY_SYNC_PLAN_HANDLE
}

/** Dev/test charges for Billing API fallback. Set SHOPIFY_BILLING_TEST=false for live. */
export function shopifyBillingTestMode(): boolean {
  const v = process.env.SHOPIFY_BILLING_TEST?.trim().toLowerCase()
  if (v === 'false' || v === '0' || v === 'no') return false
  if (v === 'true' || v === '1' || v === 'yes') return true
  return process.env.NODE_ENV !== 'production'
}

/** Comma-separated myshopify domains that skip paid Sync (e.g. offhrs-test). */
export function isShopifySyncCompedShop(shopDomain: string): boolean {
  const raw = process.env.SHOPIFY_SYNC_COMPED_SHOPS?.trim()
  if (!raw) return false
  const set = new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  )
  return set.has(shopDomain.trim().toLowerCase())
}

export function shopifyBillingAllowsSync(opts: {
  billingStatus: string | null | undefined
  shopDomain: string
}): boolean {
  if (isShopifySyncCompedShop(opts.shopDomain)) return true
  return opts.billingStatus === 'active'
}

export function mapShopifySubscriptionStatus(
  status: string | null | undefined
): ShopifyBillingStatus {
  switch ((status ?? '').toUpperCase()) {
    case 'ACTIVE':
      return 'active'
    case 'PENDING':
      return 'pending'
    case 'DECLINED':
      return 'declined'
    case 'EXPIRED':
      return 'expired'
    case 'FROZEN':
      return 'frozen'
    case 'CANCELLED':
    case 'CANCELED':
      return 'cancelled'
    default:
      return 'none'
  }
}

/** Legacy Billing API fallback if App Pricing redirect is unavailable. */
export async function createShopifySyncSubscription(opts: {
  shop: string
  accessToken: string
  returnUrl: string
}): Promise<{ confirmationUrl: string; subscriptionGid: string }> {
  const data = await shopifyAdminGraphql<{
    appSubscriptionCreate: {
      confirmationUrl: string | null
      appSubscription: { id: string; status: string } | null
      userErrors: Array<{ field: string[] | null; message: string }>
    }
  }>({
    shop: opts.shop,
    accessToken: opts.accessToken,
    query: CREATE_SUBSCRIPTION,
    variables: {
      name: SHOPIFY_SYNC_PLAN_NAME,
      returnUrl: opts.returnUrl,
      test: shopifyBillingTestMode(),
      trialDays: PARTNER_TRIAL_DAYS,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: {
                amount: SHOPIFY_SYNC_MONTHLY_CAD,
                currencyCode: 'CAD',
              },
              interval: 'EVERY_30_DAYS',
            },
          },
        },
      ],
    },
  })

  const result = data.appSubscriptionCreate
  const errors = result?.userErrors ?? []
  if (errors.length) {
    throw new Error(errors.map((e) => e.message).join('; '))
  }
  if (!result?.confirmationUrl || !result.appSubscription?.id) {
    throw new Error('Shopify did not return a confirmation URL for the Sync plan')
  }
  return {
    confirmationUrl: result.confirmationUrl,
    subscriptionGid: result.appSubscription.id,
  }
}

export async function fetchActiveAppSubscriptions(opts: {
  shop: string
  accessToken: string
}): Promise<Array<{ id: string; name: string; status: string }>> {
  const data = await shopifyAdminGraphql<{
    currentAppInstallation: {
      activeSubscriptions: Array<{ id: string; name: string; status: string }>
    } | null
  }>({
    shop: opts.shop,
    accessToken: opts.accessToken,
    query: ACTIVE_SUBSCRIPTIONS,
  })
  return data.currentAppInstallation?.activeSubscriptions ?? []
}

export async function fetchAppSubscriptionById(opts: {
  shop: string
  accessToken: string
  subscriptionGid: string
}): Promise<{ id: string; name: string; status: string } | null> {
  const data = await shopifyAdminGraphql<{
    node: { id: string; name: string; status: string } | null
  }>({
    shop: opts.shop,
    accessToken: opts.accessToken,
    query: SUBSCRIPTION_BY_ID,
    variables: { id: opts.subscriptionGid },
  })
  return data.node
}

export async function persistShopifyBillingStatus(
  admin: Admin,
  shopId: string,
  opts: {
    billingStatus: ShopifyBillingStatus
    appSubscriptionGid?: string | null
  }
): Promise<void> {
  const payload: Record<string, unknown> = {
    billing_status: opts.billingStatus,
    updated_at: new Date().toISOString(),
  }
  if (opts.appSubscriptionGid !== undefined) {
    payload.app_subscription_gid = opts.appSubscriptionGid
  }
  if (opts.billingStatus === 'active') {
    payload.billing_confirmed_at = new Date().toISOString()
    payload.sync_enabled = true
  } else if (
    opts.billingStatus === 'cancelled' ||
    opts.billingStatus === 'declined' ||
    opts.billingStatus === 'expired' ||
    opts.billingStatus === 'frozen'
  ) {
    payload.sync_enabled = false
  }

  const { error } = await admin.from('vendor_shopify_shops').update(payload).eq('id', shopId)
  if (error) throw new Error(`Failed to update Shopify billing: ${error.message}`)
}

/** After Sync billing activates, unlock partner Settings for Sync-only vendors (no Stripe Lite/Pro). */
export async function ensureVendorActiveForShopifySync(
  admin: Admin,
  vendorId: string
): Promise<void> {
  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id, status')
    .eq('id', vendorId)
    .maybeSingle()
  if (!vendor) return
  if (vendor.status === 'trialing' || vendor.status === 'active' || vendor.status === 'past_due') {
    return
  }
  await admin
    .from('vendor_profiles')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', vendorId)
}

/** Refresh billing_status from Shopify Admin API active subscriptions. */
export async function refreshShopifyBillingFromAdmin(opts: {
  admin: Admin
  shopId: string
  vendorId: string
  shopDomain: string
  accessToken: string
}): Promise<ShopifyBillingStatus> {
  if (isShopifySyncCompedShop(opts.shopDomain)) {
    await persistShopifyBillingStatus(opts.admin, opts.shopId, {
      billingStatus: 'active',
      appSubscriptionGid: null,
    })
    await ensureVendorActiveForShopifySync(opts.admin, opts.vendorId)
    return 'active'
  }

  const subs = await fetchActiveAppSubscriptions({
    shop: opts.shopDomain,
    accessToken: opts.accessToken,
  })
  const syncSub =
    subs.find((s) => s.status === 'ACTIVE' && /sync/i.test(s.name)) ||
    subs.find((s) => s.name === SHOPIFY_SYNC_PLAN_NAME) ||
    subs.find((s) => s.status === 'ACTIVE') ||
    null

  if (syncSub && syncSub.status === 'ACTIVE') {
    await persistShopifyBillingStatus(opts.admin, opts.shopId, {
      billingStatus: 'active',
      appSubscriptionGid: syncSub.id,
    })
    await ensureVendorActiveForShopifySync(opts.admin, opts.vendorId)
    return 'active'
  }

  const status = syncSub ? mapShopifySubscriptionStatus(syncSub.status) : 'none'
  await persistShopifyBillingStatus(opts.admin, opts.shopId, {
    billingStatus: status === 'none' ? 'none' : status,
    appSubscriptionGid: syncSub?.id ?? null,
  })
  return status === 'none' ? 'none' : status
}
