import { NextRequest, NextResponse } from 'next/server'
import { shopifyOAuthAppBase } from '@/lib/shopify/app-base'

/**
 * Manual shop-domain installs are not allowed for App Store distribution (2.3.1).
 * Merchants must install from the Shopify App Store or Admin install link so
 * Shopify owns the install surface and passes `shop` to the App URL.
 */
export async function GET(request: NextRequest) {
  const base = shopifyOAuthAppBase(request)
  return NextResponse.redirect(
    `${base}/partners/dashboard/settings?shopify_error=${encodeURIComponent(
      'Install from the Shopify App Store or your Shopify Admin apps page — do not enter a store domain here.'
    )}`
  )
}
