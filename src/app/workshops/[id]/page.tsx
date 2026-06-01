import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import WorkshopsAppLanding from '@/components/workshops-app-landing'

type Params = { params: Promise<{ id: string }> }

/**
 * /workshops/[id] on the web no longer serves the booking experience.
 * All consumer functionality is exclusive to the offhrs mobile app; this
 * page is kept alive so that previously-shared links (iMessage, Twitter,
 * search results) still resolve to a useful page that drives an install.
 *
 * `generateMetadata` is preserved so shared-link previews still render
 * the workshop's title and description. The page body is the standard
 * "get the app" landing, personalized with the workshop title where
 * available.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const admin = createAdminClient()
  if (!admin) {
    return {
      title: 'Workshop — get the offhrs app',
      robots: { index: false, follow: true },
    }
  }
  const { data: event } = await admin
    .from('events')
    .select('title, description')
    .eq('id', id)
    .single()
  return {
    title: event ? `${event.title} — offhrs` : 'Workshop — offhrs',
    description:
      event?.description ??
      'Book this workshop in the offhrs mobile app, available on the App Store and Google Play.',
    // Individual workshop pages no longer host bookable content; keep
    // them out of search indexes so we do not advertise a flow that
    // does not exist on the web anymore.
    robots: { index: false, follow: true },
  }
}

export default async function WorkshopDetailPage({ params }: Params) {
  const { id } = await params
  const admin = createAdminClient()

  let workshopTitle: string | null = null
  let category: string | null = null
  if (admin) {
    const { data: event } = await admin
      .from('events')
      .select('title, category')
      .eq('id', id)
      .maybeSingle()
    workshopTitle = (event?.title as string | null) ?? null
    category = (event?.category as string | null) ?? null
  }

  return <WorkshopsAppLanding workshopTitle={workshopTitle} category={category} />
}
