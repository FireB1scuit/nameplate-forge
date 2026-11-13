/**
 * Fonts -> flat outlines (plan.md §5.5).
 *
 * - opentype.js parses the TTF; variable fonts are instanced via font.variation.getTransform.
 * - Letter height = cap height. We measure the 'H' glyph because some fonts ship a wrong
 *   OS/2 sCapHeight (UnifrakturCook reports 485/2048). Fallbacks: sCapHeight, then 0.7 em.
 * - Curves are flattened adaptively to a chord tolerance in mm at the final scale.
 * - Glyphs are laid out along an arc in the unrolled rim: each glyph is rigidly rotated and
 *   translated so it is tangent to the baseline circle (never stretched).
 */
import opentype, { type Font, type Glyph, type PathCommand } from 'opentype.js';
import type { RimMap, Vec2 } from './conemap';

/** Minimal typing for the opentype.js 2.x variation API (not in @types/opentype.js 1.3). */
interface VariationManager {
  getTransform(glyph: Glyph, coords: Record<string, number>): Glyph;
}

interface GlyphShape {
  commands: PathCommand[];
  /** advance width in font units */
  advance: number;
}

export interface LoadedFont {
  id: string;
  font: Font;
  unitsPerEm: number;
  /** cap height in font units */
  capHeight: number;
  variation?: Record<string, number>;
  /** glyph index -> instanced outline */
  cache: Map<number, GlyphShape>;
}

export function parseFont(
  id: string,
  buffer: ArrayBuffer,
  variation?: Record<string, number>,
): LoadedFont {
  const font = opentype.parse(buffer);
  const lf: LoadedFont = {
    id,
    font,
    unitsPerEm: font.unitsPerEm,
    capHeight: 0,
    variation,
    cache: new Map(),
  };
  lf.capHeight = measureCapHeight(lf);
  return lf;
}

function measureCapHeight(lf: LoadedFont): number {
  const { font } = lf;
  const H = font.charToGlyph('H');
  if (H && H.index > 0) {
    const yMax = commandsYMax(glyphShape(lf, H).commands);
    if (yMax > 0.3 * lf.unitsPerEm) return yMax;
  }
  const os2 = font.tables.os2 as { sCapHeight?: number } | undefined;
  if (os2?.sCapHeight && os2.sCapHeight > 0.3 * lf.unitsPerEm) return os2.sCapHeight;
  return 0.7 * lf.unitsPerEm;
}

function commandsYMax(cmds: PathCommand[]): number {
  let m = -Infinity;
  for (const c of cmds) if ('y' in c) m = Math.max(m, c.y);
  return m;
}

function glyphShape(lf: LoadedFont, glyph: Glyph): GlyphShape {
  const cached = lf.cache.get(glyph.index);
  if (cached) return cached;
  let g = glyph;
  const vm = (lf.font as unknown as { variation?: VariationManager }).variation;
  if (lf.variation && vm && lf.font.tables.fvar) {
    g = vm.getTransform(glyph, lf.variation);
  }
  const shape: GlyphShape = {
    commands: g.path?.commands ?? [],
    advance: g.advanceWidth ?? glyph.advanceWidth ?? 0,
  };
  lf.cache.set(glyph.index, shape);
  return shape;
}

/**
 * Flatten path commands (font units, y-up) to closed polygons in mm.
 * `tol` is the max chord deviation in mm.
 */
export function flattenCommands(cmds: PathCommand[], scale: number, tol: number): Vec2[][] {
  const out: Vec2[][] = [];
  let cur: Vec2[] = [];
  let x = 0;
  let y = 0;
  const tolU = tol / scale; // tolerance in font units
  const push = (px: number, py: number) => cur.push([px * scale, py * scale]);
  const close = () => {
    if (cur.length > 0) {
      const a = cur[0];
      const b = cur[cur.length - 1];
      if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) cur.pop();
      if (cur.length >= 3) out.push(cur);
    }
    cur = [];
  };
  for (const c of cmds) {
    switch (c.type) {
      case 'M':
        close();
        x = c.x;
        y = c.y;
        push(x, y);
        break;
      case 'L':
        x = c.x;
        y = c.y;
        push(x, y);
        break;
      case 'Q': {
        // error of a straight chord ≈ |P0 − 2P1 + P2| / 4; n segments → / n²
        const dd = Math.hypot(x - 2 * c.x1 + c.x, y - 2 * c.y1 + c.y);
        const n = Math.min(64, Math.max(1, Math.ceil(Math.sqrt(dd / (4 * tolU)))));
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          const mt = 1 - t;
          push(
            mt * mt * x + 2 * mt * t * c.x1 + t * t * c.x,
            mt * mt * y + 2 * mt * t * c.y1 + t * t * c.y,
          );
        }
        x = c.x;
        y = c.y;
        break;
      }
      case 'C': {
        const dd = Math.max(
          Math.hypot(x - 2 * c.x1 + c.x2, y - 2 * c.y1 + c.y2),
          Math.hypot(c.x1 - 2 * c.x2 + c.x, c.y1 - 2 * c.y2 + c.y),
        );
        const n = Math.min(64, Math.max(1, Math.ceil(Math.sqrt((3 * dd) / (4 * tolU)))));
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          const mt = 1 - t;
          const a = mt * mt * mt;
          const b = 3 * mt * mt * t;
          const cc = 3 * mt * t * t;
          const d = t * t * t;
          push(a * x + b * c.x1 + cc * c.x2 + d * c.x, a * y + b * c.y1 + cc * c.y2 + d * c.y);
        }
        x = c.x;
        y = c.y;
        break;
      }
      case 'Z':
        close();
        break;
    }
  }
  close();
  return out;
}

export interface LineMetrics {
  /** characters in the line, including spaces */
  chars: number;
  /** glyphs (with font units advance incl. kerning to the next glyph) */
  glyphs: Glyph[];
  advances: number[];
  /** sum of advances + kerning, in font units */
  advanceUnits: number;
  /** characters the font doesn't contain */
  missing: string[];
}

export function measureLine(lf: LoadedFont, text: string): LineMetrics {
  const glyphs = lf.font.stringToGlyphs(text);
  const advances: number[] = [];
  let total = 0;
  for (let i = 0; i < glyphs.length; i++) {
    let adv = glyphShape(lf, glyphs[i]).advance;
    if (i < glyphs.length - 1) adv += lf.font.getKerningValue(glyphs[i], glyphs[i + 1]) || 0;
    advances.push(adv);
    total += adv;
  }
  const chars = [...text];
  const missing = chars.filter((ch) => ch.trim() !== '' && lf.font.charToGlyphIndex(ch) === 0);
  return { chars: chars.length, glyphs, advances, advanceUnits: total, missing };
}

/** Width in mm of a line at the given cap height and letter spacing. */
export function lineWidth(lf: LoadedFont, m: LineMetrics, size: number, spacing: number): number {
  if (m.glyphs.length === 0) return 0;
  return (m.advanceUnits * size) / lf.capHeight + spacing * (m.glyphs.length - 1);
}

/** Cap height (mm) that makes the line exactly `width` mm wide. */
export function sizeForWidth(
  lf: LoadedFont,
  m: LineMetrics,
  width: number,
  spacing: number,
): number {
  if (m.advanceUnits <= 0) return Infinity;
  return ((width - spacing * (m.glyphs.length - 1)) * lf.capHeight) / m.advanceUnits;
}

/**
 * Lay a line out along the baseline circle at slant height `vBaseline`, centred on arc 0.
 * Returns flat-space contours (all glyphs; overlapping contours are fine with NonZero fill).
 */
export function layoutLineOnArc(
  lf: LoadedFont,
  m: LineMetrics,
  size: number,
  spacing: number,
  map: RimMap,
  vBaseline: number,
  tol = 0.01,
): Vec2[][] {
  const scale = size / lf.capHeight; // font units -> mm
  const width = lineWidth(lf, m, size, spacing);
  const contours: Vec2[][] = [];
  let pen = -width / 2;
  for (let i = 0; i < m.glyphs.length; i++) {
    const shape = glyphShape(lf, m.glyphs[i]);
    const adv = shape.advance * scale;
    if (shape.commands.length > 0) {
      const centre = pen + adv / 2;
      const f = map.frameAt(centre, vBaseline);
      const c = Math.cos(f.rot);
      const s = Math.sin(f.rot);
      for (const poly of flattenCommands(shape.commands, scale, tol)) {
        contours.push(
          poly.map(([gx, gy]): Vec2 => {
            const px = gx - adv / 2; // glyph-local, origin at the advance centre on the baseline
            return [f.x + px * c - gy * s, f.y + px * s + gy * c];
          }),
        );
      }
    }
    pen += m.advances[i] * scale + spacing;
  }
  return contours;
}
