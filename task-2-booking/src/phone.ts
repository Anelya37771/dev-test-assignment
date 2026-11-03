const MOBILE_CODES = /^(70[0-8]|747|77[15-8])$/;

// Казахстанский мобильный: +7 7xx xxx xx xx. Возвращает '+77012345678' или null
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  // только цифры, пробелы, скобки, дефисы и плюс в начале
  if (!/^\+?[\d\s()-]+$/.test(value)) return null;

  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return null;

  // +7 701 ... или 8 701 ...; с плюсом допустима только 7
  const country = digits[0];
  if (value.startsWith('+') ? country !== '7' : country !== '7' && country !== '8') return null;

  // коды мобильных операторов Казахстана; 7xx бывают и городскими (727 — Алматы), поэтому список
  if (!MOBILE_CODES.test(digits.slice(1, 4))) return null;

  return `+7${digits.slice(1)}`;
}