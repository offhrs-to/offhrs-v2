/**
 * Max rows for workshop **browse** (date strip needs a wide window).
 * Fetched in PostgREST-sized batches so one-offs after the first N calendar days still appear.
 */
export const WORKSHOP_MAX_UPCOMING_FETCH = 5000

/** PostgREST / Supabase typical max rows per request; used for ranged batching. */
export const WORKSHOP_EVENTS_FETCH_BATCH = 1000

/** Lighter fetch caps for screens that don’t need thousands of rows (faster network + less JS work). */
export const WORKSHOP_FETCH_LIMIT_MAP_SCREEN = 650
export const WORKSHOP_FETCH_LIMIT_HUB_PREVIEW = 200
export const WORKSHOP_FETCH_LIMIT_SEARCH = 900

/**
 * react-native-maps degrades with hundreds of markers; list may still show more rows than this.
 */
export const WORKSHOP_MAP_MARKER_CAP = 280

/** Hub mini-map: keep native pin count tiny. */
export const WORKSHOP_PREVIEW_MARKER_CAP = 28

/** Workshops shown per page in list view before paging. */
export const WORKSHOP_LIST_PAGE_SIZE = 20

