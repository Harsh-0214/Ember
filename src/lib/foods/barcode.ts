/** Barcode helpers (EAN-13, EAN-8, UPC-A, UPC-E). */

export const isBarcode = (s: string): boolean => /^\d{8}$|^\d{12,14}$/.test(s);

/** GS1 check digit for the given digits (without check digit). */
export function gs1CheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  return gs1CheckDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}

/** Expands a UPC-E (8 digits, number system 0/1) to UPC-A. */
export function upcEToA(upce: string): string | null {
  if (!/^[01]\d{7}$/.test(upce)) return null;
  const ns = upce[0]!;
  const d = upce.slice(1, 7);
  const check = upce[7]!;
  const last = d[5]!;
  let body: string;
  if ("012".includes(last)) body = `${d[0]}${d[1]}${last}0000${d[2]}${d[3]}${d[4]}`;
  else if (last === "3") body = `${d[0]}${d[1]}${d[2]}00000${d[3]}${d[4]}`;
  else if (last === "4") body = `${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}`;
  else body = `${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}0000${last}`;
  return `${ns}${body}${check}`;
}

/**
 * Equivalent representations of a barcode, for cache lookups:
 * UPC-A (12) ⇄ EAN-13 with a leading 0 ⇄ GTIN-14, plus UPC-E expansion.
 */
export function barcodeVariants(raw: string): string[] {
  const code = raw.replace(/\D/g, "");
  if (!code) return [];
  const out = new Set<string>([code]);
  const add = (c: string) => out.add(c);
  if (code.length === 8) {
    const a = upcEToA(code);
    if (a) {
      add(a);
      add(`0${a}`);
    }
  }
  if (code.length === 12) add(`0${code}`);
  if (code.length === 13 && code.startsWith("0")) add(code.slice(1));
  if (code.length === 14) {
    add(code.replace(/^0+/, "").padStart(13, "0"));
    if (code.startsWith("00")) add(code.slice(2));
  }
  return [...out].filter((c) => c.length >= 8);
}
