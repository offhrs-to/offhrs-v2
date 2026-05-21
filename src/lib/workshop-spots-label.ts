/**
 * Consistent partner-facing wording for workshop capacity ("X of Y spots filled").
 * Used by both the dashboard overview rail and the workshops list so the labels
 * stay in sync.
 */
export function spotsFilledLabel(
  maxAttendees: number | null | undefined,
  availableSlots: number | null | undefined
): string {
  const cap = maxAttendees ?? 0
  if (cap <= 0) return 'Capacity not set'
  const remaining = availableSlots ?? cap
  const filled = Math.max(0, Math.min(cap, cap - remaining))
  return `${filled} of ${cap} spots filled`
}
