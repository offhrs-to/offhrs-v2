/** Sorted unique page indices to show (1-based), with gaps filled by ellipsis in UI */
export function getVisiblePageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 9) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const set = new Set<number>()
  set.add(1)
  set.add(total)
  for (let d = -2; d <= 2; d++) {
    const p = current + d
    if (p >= 1 && p <= total) set.add(p)
  }
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | 'ellipsis')[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      out.push('ellipsis')
    }
    out.push(sorted[i])
  }
  return out
}
