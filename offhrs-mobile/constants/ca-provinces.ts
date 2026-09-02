/** Canadian provinces and territories (ISO 3166-2:CA codes). */
export const CA_PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
] as const;

export type CaProvinceCode = (typeof CA_PROVINCES)[number]['code'];

export function isCaProvinceCode(value: string): value is CaProvinceCode {
  return CA_PROVINCES.some((p) => p.code === value);
}

export function provinceLabel(code: string): string {
  const found = CA_PROVINCES.find((p) => p.code === code);
  return found ? `${found.code} — ${found.name}` : code;
}
