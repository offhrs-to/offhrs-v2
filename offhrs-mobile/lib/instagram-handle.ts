export function instagramProfileUrl(handle: string): string {
  const h = handle.replace(/^@/, '').trim();
  if (!h) return '';
  return `https://www.instagram.com/${h}/`;
}
