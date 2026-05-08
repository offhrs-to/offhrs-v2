/**
 * Production webapp URL for API calls (e.g. /api/book).
 * Hardcoded so redirect counting works from TestFlight/production builds
 * even when EXPO_PUBLIC_APP_URL is unset or wrong in EAS.
 */
export const BOOK_API_BASE = 'https://offhrs.app'

