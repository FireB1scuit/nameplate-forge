/**
 * Design <-> URL hash (plan.md §5.7).
 * `#d=` + lz-string(JSON(diff(design, defaults))). Only non-default fields are stored.
 */
import LZString from 'lz-string';
import {
  DEFAULT_DESIGN,
  DESIGN_VERSION,
  defaultsForVersion,
  sanitizeDesign,
  type Design,
} from './schema';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Recursive diff: keeps keys of `value` whose value differs from `base`. Arrays compare whole. */
export function diff(value: unknown, base: unknown): unknown {
  if (isObj(value) && isObj(base)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (!(key in base)) {
        out[key] = value[key];
        continue;
      }
      const d = diff(value[key], base[key]);
      if (d !== undefined) out[key] = d;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return jsonEqual(value, base) ? undefined : value;
}

/** Recursive merge of a diff back onto a base object. */
export function merge(base: unknown, patch: unknown): unknown {
  if (isObj(base) && isObj(patch)) {
    const out: Record<string, unknown> = { ...base };
    for (const key of Object.keys(patch)) out[key] = merge(base[key], patch[key]);
    return out;
  }
  return patch === undefined ? base : patch;
}

/** Round numbers to 4 decimals so float noise from sliders doesn't bloat links. */
function roundNumbers(x: unknown): Json {
  if (typeof x === 'number') return Math.round(x * 1e4) / 1e4;
  if (Array.isArray(x)) return x.map(roundNumbers);
  if (isObj(x)) {
    const o: Record<string, Json> = {};
    for (const [k, v] of Object.entries(x)) o[k] = roundNumbers(v);
    return o;
  }
  return x as Json;
}

export function encodeDesign(design: Design): string {
  const d = (diff(roundNumbers(design), DEFAULT_DESIGN) ?? {}) as Record<string, unknown>;
  // always store the version so future migrations know what they are reading
  return LZString.compressToEncodedURIComponent(JSON.stringify({ ...d, v: DESIGN_VERSION }));
}

/** Returns null when the string is not a valid encoded design. */
export function decodeDesign(encoded: string): Design | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const parsed: unknown = JSON.parse(json);
    if (!isObj(parsed)) return null;
    // only changed fields are stored: fill the rest from the defaults of the link's version
    const v = parsed.v ?? 1;
    const filled = merge(defaultsForVersion(v), parsed) as Record<string, unknown>;
    // a link with no version is from v1
    return sanitizeDesign({ ...filled, v });
  } catch {
    return null;
  }
}

export const HASH_KEY = 'd';

export function designToHash(design: Design): string {
  return `#${HASH_KEY}=${encodeDesign(design)}`;
}

export function designFromHash(hash: string): Design | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const value = params.get(HASH_KEY);
  return value ? decodeDesign(value) : null;
}
