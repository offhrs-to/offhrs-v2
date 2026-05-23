import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

export const VENDOR_WORKSHOP_IMAGES_BUCKET = 'vendor-workshop-images'

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function extForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'bin'
}

export async function uploadVendorWorkshopImage(
  admin: SupabaseClient,
  params: { pathPrefix: string; buffer: Buffer; contentType: string }
): Promise<{ publicUrl: string } | { error: string }> {
  const { pathPrefix, buffer, contentType } = params
  if (!ALLOWED.has(contentType)) return { error: 'Use JPEG, PNG, or WebP.' }
  if (buffer.length > MAX_BYTES) return { error: 'Image must be 2 MB or smaller.' }
  const objectPath = `${pathPrefix.replace(/\/$/, '')}/${randomUUID()}.${extForMime(contentType)}`
  const { error: upErr } = await admin.storage.from(VENDOR_WORKSHOP_IMAGES_BUCKET).upload(objectPath, buffer, {
    contentType,
    upsert: false,
  })
  if (upErr) return { error: upErr.message }
  const { data } = admin.storage.from(VENDOR_WORKSHOP_IMAGES_BUCKET).getPublicUrl(objectPath)
  return { publicUrl: data.publicUrl }
}
