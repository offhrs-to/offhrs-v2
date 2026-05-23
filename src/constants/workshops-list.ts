/** Cap rows returned from Supabase (upcoming filter applied server-side) to keep initial load fast. */
export const WORKSHOP_MAX_UPCOMING_FETCH = 300

/** Default workshops per page (grid); users can switch 20 / 50 / 100 in UI. */
export const WORKSHOP_DEFAULT_PAGE_SIZE = 20 as const

