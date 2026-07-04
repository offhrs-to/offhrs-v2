/** Normalize user input to a bare Instagram username, or null if invalid/empty. */
export function normalizeInstagramHandle(raw: string | null | undefined): string | null {
  let s = (raw ?? '').trim()
  if (!s) return null

  const urlMatch = s.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)/i)
  if (urlMatch?.[1]) s = urlMatch[1]

  s = s.replace(/^@/, '').replace(/\/+$/, '')
  if (!/^[A-Za-z0-9._]{1,30}$/.test(s)) return null
  return s
}

export function instagramProfileUrl(handle: string): string {
  const normalized = normalizeInstagramHandle(handle)
  if (!normalized) return ''
  return `https://www.instagram.com/${normalized}/`
}

export function formatInstagramHandleLabel(handle: string): string {
  const normalized = normalizeInstagramHandle(handle)
  return normalized ? `@${normalized}` : ''
}
