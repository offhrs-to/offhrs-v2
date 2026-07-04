/** Allowed tags for partner workshop description rich text (Option A). */
const ALLOWED_TAGS = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li'])

export const WORKSHOP_RICH_TEXT_MAX_PLAIN_LENGTH = 2000

export function isWorkshopHtml(value: string): boolean {
  return /<[a-z][^>]*>/i.test(value.trim())
}

/** Visible character count (ignores markup). */
export function workshopRichTextPlainLength(value: string): number {
  return stripWorkshopRichTextPlain(value).length
}

export function stripWorkshopRichTextPlain(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Normalize stored value for the contentEditable editor. */
export function workshopRichTextForEditor(stored: string): string {
  const trimmed = stored.trim()
  if (!trimmed) return ''
  if (isWorkshopHtml(trimmed)) return trimmed

  return trimmed
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** Browsers often insert `<div>` on Enter in contentEditable; normalize to `<br>`. */
function normalizeContentEditableBlocks(html: string): string {
  return html
    .replace(/<div><br\s*\/?><\/div>/gi, '<br>')
    .replace(/<div>\s*<\/div>/gi, '<br>')
    .replace(/<\/div>\s*<div[^>]*>/gi, '<br>')
    .replace(/<div[^>]*>/gi, '<br>')
    .replace(/<\/div>/gi, '')
}

/** Strip unsafe markup; keep bold, italic, underline, and lists only. */
export function sanitizeWorkshopHtml(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''

  if (!isWorkshopHtml(trimmed)) {
    return trimmed
  }

  let html = normalizeContentEditableBlocks(trimmed)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')

  html = html.replace(/<\/?([a-z0-9]+)(?:\s+[^>]*)?\/?>/gi, (full, tagName: string) => {
    const tag = tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return ''
    if (full.startsWith('</')) return `</${tag}>`
    if (tag === 'br' || full.endsWith('/>')) return '<br>'
    return `<${tag}>`
  })

  return html.trim()
}

export function sanitizeWorkshopRichTextField(value: string | undefined | null): string | null {
  if (value == null) return null
  const sanitized = sanitizeWorkshopHtml(String(value))
  if (!sanitized) return null
  if (workshopRichTextPlainLength(sanitized) > WORKSHOP_RICH_TEXT_MAX_PLAIN_LENGTH) {
    throw new Error(`Description must be ${WORKSHOP_RICH_TEXT_MAX_PLAIN_LENGTH} characters or less`)
  }
  return sanitized
}

const RICH_TEXT_FIELDS = [
  'description',
  'workshop_experience',
  'workshop_materials_takeaway',
  'workshop_skill_level',
] as const

/** Sanitize rich-text workshop fields on incoming JSON before validation/persist. */
export function applyWorkshopRichTextFields(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const obj = { ...(raw as Record<string, unknown>) }
  for (const field of RICH_TEXT_FIELDS) {
    if (!(field in obj) || obj[field] == null || obj[field] === '') continue
    obj[field] = sanitizeWorkshopRichTextField(String(obj[field]))
  }
  return obj
}
