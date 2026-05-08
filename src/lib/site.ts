/**
 * Canonical site URL for SEO, sitemap, and Open Graph.
 * Prefer NEXT_PUBLIC_SITE_URL in production (https://offhrs.app).
 */
export function getSiteUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  return fromEnv ?? 'http://localhost:3000'
}
