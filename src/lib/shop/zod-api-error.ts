import type { ZodError } from 'zod'

/** Prefer a concrete field/form message over a generic "Validation failed". */
export function zodErrorMessage(error: ZodError, fallback = 'Validation failed'): string {
  const flat = error.flatten()
  const fromFields = Object.values(flat.fieldErrors)
    .flat()
    .find((m): m is string => typeof m === 'string' && m.length > 0)
  if (fromFields) return fromFields
  const fromForm = flat.formErrors.find((m) => typeof m === 'string' && m.length > 0)
  if (fromForm) return fromForm
  return error.issues[0]?.message || fallback
}
