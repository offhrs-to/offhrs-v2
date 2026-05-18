/** Optional consumer phone — stored on `profiles.phone` for partner Clients → Mobile. */
export function normalizeProfilePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length > 0 && digits.length < 10) {
    throw new Error('Enter at least 10 digits or leave phone blank.');
  }
  if (digits.length > 15) {
    throw new Error('Phone number is too long.');
  }
  return trimmed;
}
