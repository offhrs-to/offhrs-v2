import { verifyAdmin } from '@/app/api/admin/login/route'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  analyzeConnectedShopifyProduct,
  listConnectedShopifyShops,
} from '@/lib/shopify/preview-connected-product'
import { analyzePublicShopifyProduct } from '@/lib/shopify/preview-public-product'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/admin/shopify-sync-preview
 * Lists connected shops for the deep-scan dropdown.
 */
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  }

  try {
    const shops = await listConnectedShopifyShops(admin)
    return NextResponse.json({ shops })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to list shops' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/shopify-sync-preview
 * Body: { url: string, mode?: 'public' | 'connected', shop_domain?: string }
 */
export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const url =
    typeof body === 'object' &&
    body !== null &&
    'url' in body &&
    typeof (body as { url: unknown }).url === 'string'
      ? (body as { url: string }).url.trim()
      : ''

  const mode =
    typeof body === 'object' &&
    body !== null &&
    'mode' in body &&
    (body as { mode: unknown }).mode === 'connected'
      ? 'connected'
      : 'public'

  const shopDomain =
    typeof body === 'object' &&
    body !== null &&
    'shop_domain' in body &&
    typeof (body as { shop_domain: unknown }).shop_domain === 'string'
      ? (body as { shop_domain: string }).shop_domain.trim()
      : undefined

  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  if (mode === 'public') {
    const result = await analyzePublicShopifyProduct(url)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 422 })
    }
    return NextResponse.json(result)
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  }

  const result = await analyzeConnectedShopifyProduct(admin, {
    productUrl: url,
    shopDomain: shopDomain || null,
  })
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json(result)
}
