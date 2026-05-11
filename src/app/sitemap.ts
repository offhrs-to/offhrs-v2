import { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSiteUrl } from '@/lib/site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl()
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/workshops`, lastModified: now, changeFrequency: 'daily', priority: 0.95 },
    { url: `${base}/partners`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/disclaimer`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]

  const admin = createAdminClient()
  if (!admin) return staticRoutes

  const { data: saasEvents } = await admin
    .from('events')
    .select('id, created_at')
    .not('vendor_profile_id', 'is', null)
    .in('booking_status', ['published', 'fully_booked'])
    .limit(2000)

  const workshopEntries: MetadataRoute.Sitemap = (saasEvents ?? []).map((row) => ({
    url: `${base}/workshops/${row.id}`,
    lastModified: row.created_at ? new Date(row.created_at) : now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...staticRoutes, ...workshopEntries]
}
