/** Analytics + /api/book + open vendor URL (shared by EventCard and quick view). */
export type WorkshopOutboundPayload = {
  id: number | string
  title: string
  category: string
  price?: number | string | null
  external_link?: string | null
}

export function openWorkshopBooking(event: WorkshopOutboundPayload) {
  // Meta Pixel Lead event — only fires when the visitor accepted ad cookies (pixel loaded).
  if (typeof window !== 'undefined' && (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq) {
    ;(window as unknown as { fbq: (...args: unknown[]) => void }).fbq('track', 'Lead', {
      content_name: event.title,
      content_category: event.category,
      value: event.price ? Number(event.price) : 0,
      currency: 'CAD',
    })
  }

  fetch('/api/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_id: event.id,
      event_title: event.title,
    }),
  }).catch(() => {})

  const url = event.external_link?.trim()
  if (url) {
    setTimeout(() => {
      window.open(url, '_blank')
    }, 150)
  }
}

