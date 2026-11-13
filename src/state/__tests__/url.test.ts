import { describe, expect, it } from 'vitest';
import { DEFAULT_DESIGN, sanitizeDesign, type Design } from '../schema';
import { decodeDesign, designFromHash, designToHash, diff, encodeDesign, merge } from '../url';

const clone = (d: Design): Design => structuredClone(d);

describe('diff / merge', () => {
  it('stores only changed fields', () => {
    const d = clone(DEFAULT_DESIGN);
    d.text.line1 = 'SERGEANT VALE';
    d.plate.angleDeg = 30;
    expect(diff(d, DEFAULT_DESIGN)).toEqual({
      text: { line1: 'SERGEANT VALE' },
      plate: { angleDeg: 30 },
    });
  });

  it('returns undefined for identical designs', () => {
    expect(diff(clone(DEFAULT_DESIGN), DEFAULT_DESIGN)).toBeUndefined();
  });

  it('merge(diff) restores the original', () => {
    const d = clone(DEFAULT_DESIGN);
    d.base.bottom = [40, 40];
    d.style.themeId = 'riveted';
    expect(merge(DEFAULT_DESIGN, diff(d, DEFAULT_DESIGN))).toEqual(d);
  });
});

describe('encode / decode', () => {
  it('round-trips a modified design', () => {
    const d = clone(DEFAULT_DESIGN);
    d.text.line1 = 'Castellan Rho';
    d.text.fontId = 'unifrakturcook';
    d.text.uppercase = false;
    d.base = { ...d.base, presetId: 'custom', bottom: [33, 33], top: [30, 30], height: 3.5 };
    d.plate.width = { mode: 'mm', value: 30 };
    expect(decodeDesign(encodeDesign(d))).toEqual(d);
  });

  it('round-trips the defaults with a tiny payload', () => {
    const enc = encodeDesign(DEFAULT_DESIGN);
    expect(enc.length).toBeLessThan(20);
    expect(decodeDesign(enc)).toEqual(DEFAULT_DESIGN);
  });

  it('works through the URL hash', () => {
    const d = clone(DEFAULT_DESIGN);
    d.text.line1 = 'Ünïcødé & spaces?#=';
    expect(designFromHash(designToHash(d))).toEqual(d);
  });

  it('rejects garbage', () => {
    expect(decodeDesign('not-a-design')).toBeNull();
    expect(designFromHash('#foo=bar')).toBeNull();
  });
});

describe('sanitizeDesign', () => {
  it('fills defaults for missing fields', () => {
    expect(sanitizeDesign({})).toEqual(DEFAULT_DESIGN);
    expect(sanitizeDesign(null)).toEqual(DEFAULT_DESIGN);
  });

  it('clamps and coerces untrusted values', () => {
    const d = sanitizeDesign({
      text: { size1: 999, line1: 'A\u0000B', fontId: 'comic-sans', uppercase: 'yes' },
      plate: { gap: -4, width: { mode: 'weird', value: 'x' } },
      base: { presetId: 'nope', bottom: [20, 20], top: [50, 50] },
      style: { themeId: 'nope', outline: 'blob', border: { type: 'zigzag', width: 99 } },
    });
    expect(d.text.size1).toBe(8);
    expect(d.text.line1).toBe('AB');
    expect(d.text.fontId).toBe(DEFAULT_DESIGN.text.fontId);
    expect(d.text.uppercase).toBe(true);
    expect(d.plate.gap).toBe(0);
    expect(d.plate.width).toEqual(DEFAULT_DESIGN.plate.width);
    expect(d.base.presetId).toBe(DEFAULT_DESIGN.base.presetId);
    expect(d.base.top).toEqual([20, 20]); // top can't exceed bottom
    expect(d.style.themeId).toBe('plain');
    expect(d.style.outline).toBe(DEFAULT_DESIGN.style.outline);
    expect(d.style.border.type).toBe('none');
    expect(d.style.border.width).toBe(1);
  });
});
