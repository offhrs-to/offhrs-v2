import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import {
  ensureMarketplaceIncludedFlags,
  vendorHasMarketplaceAccess,
} from '@/lib/shop/access'
import { uploadShopProductImage } from '@/lib/shop/product-images'

const MAX_BYTES = 2 * 1024 * 1024

/** POST multipart form: field `file` — returns `{ url }` for product images. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    await ensureMarketplaceIncludedFlags(admin, vendor.id)
    if (!(await vendorHasMarketplaceAccess(admin, vendor.id))) {
      return NextResponse.json({ error: 'Marketplace access required' }, { status: 403 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    if (buf.length > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be 2 MB or smaller' }, { status: 400 })
    }

    const contentType = file.type || 'application/octet-stream'
    const result = await uploadShopProductImage(admin, {
      pathPrefix: `vendors/${vendor.id}`,
      buffer: buf,
      contentType,
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ url: result.publicUrl })
  } catch (e) {
    console.error('[shop-product-images]', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
