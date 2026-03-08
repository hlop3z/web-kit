/* ── Fractional Indexing ──────────────────────────── */

/**
 * Generates order keys between two existing keys.
 * Based on the algorithm used by Figma, Notion, Linear, Trello.
 *
 * Keys are base-36 strings that sort lexicographically.
 * Insertions are O(1) and conflict-free.
 */

const BASE = 36;
const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

const midpoint = (a, b) => {
  // Find the lexicographic midpoint between two base-36 strings
  if (a >= b) throw new Error(`Invalid range: "${a}" >= "${b}"`);

  let result = "";
  const max_len = Math.max(a.length, b.length) + 1;

  for (let i = 0; i < max_len; i++) {
    const ca = i < a.length ? DIGITS.indexOf(a[i]) : 0;
    const cb = i < b.length ? DIGITS.indexOf(b[i]) : BASE;

    if (ca === cb) {
      result += a[i] || "0";
      continue;
    }

    const mid = Math.floor((ca + cb) / 2);
    if (mid > ca) {
      result += DIGITS[mid];
      return result;
    }

    // ca and cb are adjacent, extend into next digit
    result += DIGITS[ca];
  }

  // Fallback — append midpoint character
  return result + DIGITS[Math.floor(BASE / 2)];
};

/**
 * Generate a key between `a` and `b`.
 * - `a` is null for "before first"
 * - `b` is null for "after last"
 */
const generate_key_between = (a, b) => {
  if (a === null && b === null) return "a0";
  if (a === null) {
    // Before first — find something less than b
    const first_char = DIGITS.indexOf(b[0]);
    if (first_char > 0) return DIGITS[Math.floor(first_char / 2)];
    return midpoint("", b);
  }
  if (b === null) {
    // After last — increment last character
    const last = a[a.length - 1];
    const idx = DIGITS.indexOf(last);
    if (idx < BASE - 1) return a.slice(0, -1) + DIGITS[idx + 1];
    return a + DIGITS[Math.floor(BASE / 2)];
  }
  return midpoint(a, b);
};

/**
 * Generate `n` evenly-spaced keys between `a` and `b`.
 */
const generate_n_keys_between = (a, b, n) => {
  if (n === 0) return [];
  const keys = [];
  let prev = a;
  for (let i = 0; i < n; i++) {
    const next = i === n - 1 ? b : null;
    const key = generate_key_between(prev, next || b);
    keys.push(key);
    prev = key;
  }
  return keys;
};

/**
 * Reindex an array of items, assigning fresh fractional order keys.
 * Items must have an `order` property.
 */
const reindex = (items) => {
  if (items.length === 0) return items;
  const keys = generate_n_keys_between(null, null, items.length);
  return items.map((item, i) => ({ ...item, order: keys[i] }));
};

export { generate_key_between, generate_n_keys_between, reindex };
