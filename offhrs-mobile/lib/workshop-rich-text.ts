/** Mirror of server workshop rich-text helpers for mobile display. */

export function isWorkshopHtml(value: string): boolean {
  return /<[a-z][^>]*>/i.test(value.trim())
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

/** Wrap fragment for react-native-render-html. */
export function workshopRichTextHtmlDocument(fragment: string): string {
  return `<div>${fragment}</div>`
}
