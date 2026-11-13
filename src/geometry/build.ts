/**
 * Top-level geometry pipeline (plan.md §5.3, §5.6). Pure: takes the manifold wasm module and an
 * asset provider, so it runs in the Web Worker and in Node (Vitest) alike.
 *
 *   plate2D   = outline (bent into the unrolled rim) − fire-arc notches   [cut: − text]
 *   details2D = (text [raised] ∪ border ∪ icon art) ∩ plate2D
 *   solid     = extrude(plate2D, T) [engraved: − text recess] ∪ translateZ(extrude(details2D, D), T)
 *               ∪ rivet domes
 *   solid     = warp(refineToLength(solid)): surface texture, blend taper, then onto the rim
 *   solid    ∪= top lip (world space, round bases)
 *
 * Triangles that came from text/decoration keep their mesh ID through every boolean, refine and
 * warp, so the viewer can paint them and 3MF export can split them.
 */
import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d';
import { findFont } from '../data/fonts';
import type { SurfaceType } from '../data/themes';
import { resolveBase, type Design } from '../state/schema';
import { baseSolid, createBaseMap } from './basemap';
import type { RimMap, Vec2, Vec3 } from './conemap';
import { placeIcon, type IconArt } from './endcaps';
import {
  bendPolygon,
  outlineExtension,
  outlinePolygon,
  rivetCentres,
  type PlateRect,
} from './outline';
import { surfaceDepth } from './surface';
import {
  layoutGlyphsOnArc,
  lineWidth,
  measureLine,
  sizeForWidth,
  type LineMetrics,
  type LoadedFont,
} from './text';

export type Quality = 'preview' | 'export';
export type Printer = 'resin' | 'fdm';

/** Smallest printable feature per printer profile (plan.md §3.6). */
export const MIN_FEATURE: Record<Printer, number> = { resin: 0.3, fdm: 0.8 };

export interface FontProvider {
  get(fontId: string): Promise<LoadedFont>;
  /** icon artwork by id (bundled or uploaded); optional so tests can skip icons */
  icon?(id: string): Promise<IconArt | null>;
}

export interface BuildOptions {
  quality?: Quality;
  printer?: Printer;
  /** also return plate and details as separate meshes (3MF multi-colour) */
  parts?: boolean;
  /** union the plate with the base (plate + base export); the fit gap is ignored */
  withBase?: boolean;
  /** run the thin-stroke analysis (default: on) */
  strokeCheck?: boolean;
}

export interface FitInfo {
  /** characters in line 1 (including spaces) */
  chars: number;
  /** estimated characters that fit at the requested letter height */
  capacity: number;
  /** every line fits the plate width at the requested size without shrinking */
  fits: boolean;
  /** the text block fits the plate height (inside any border) at the requested size */
  fitsHeight: boolean;
  /** letter height of line 1 actually used (after auto-shrink) */
  sizeUsed: number;
  /** letter height of line 2 actually used */
  size2Used: number;
  shrunk: boolean;
  /** measured text width of line 1 at the requested size (mm, along the baseline) */
  textWidth: number;
  /** text width available (mm, along the baseline) */
  available: number;
}

export type WarningCode =
  | 'readability'
  | 'too-small'
  | 'line2-small'
  | 'overflow'
  | 'clipped'
  | 'too-wide'
  | 'missing-glyphs'
  | 'border-touch'
  | 'plate-off-rim'
  | 'plate-grown'
  | 'thin-strokes'
  | 'thin-border'
  | 'engrave-depth'
  | 'cut-islands'
  | 'oval-curve'
  | 'lip-unsupported'
  | 'fire-arc-outside'
  | 'icon-missing'
  | 'fdm-thin'
  | 'not-watertight';

export interface BuildWarning {
  level: 'info' | 'warn' | 'error';
  code: WarningCode;
  message: string;
}

export interface BuildStats {
  status: string;
  watertight: boolean;
  components: number;
  genus: number;
  volume: number;
  triangles: number;
  bbox: { min: [number, number, number]; max: [number, number, number] };
  /** plate size: width along the rim (mid height), height up the slant, total thickness */
  plate: { width: number; height: number; thickness: number; degrees: number };
  buildMs: number;
}

export interface MeshData {
  /** xyz, mm, world Z-up */
  positions: Float32Array;
  indices: Uint32Array;
  /** triangle ranges [firstTriangle, count] that are text/decoration (painted preview) */
  paint: Array<[number, number]>;
}

export interface BuildResult {
  mesh: MeshData;
  parts?: { plate: MeshData; details: MeshData | null };
  stats: BuildStats;
  fit: FitInfo;
  warnings: BuildWarning[];
  /** outward rim normal at the plate centre (flat-for-print orientation) */
  normal: Vec3;
}

/** Below this letter height the print check warns about readability. */
export const READABLE_SIZE = 3.0;
export const MIN_READABLE_SIZE = 2.0;
/** Auto-shrink never goes below this. */
export const MIN_SHRINK_SIZE = 1.5;
/** Area a glyph may lose to the min-feature erosion test before it's flagged as too thin. */
export const STROKE_LOSS = 0.12;
/** overlap between the plate and raised layers so the union is robust */
const EPS = 0.01;

/** Tracks wasm objects so every intermediate is freed, even on error. */
class Scope {
  private items: Array<{ delete(): void }> = [];
  add<T extends { delete(): void }>(x: T): T {
    this.items.push(x);
    return x;
  }
  dispose() {
    for (const x of this.items.splice(0)) {
      try {
        x.delete();
      } catch {
        /* already freed */
      }
    }
  }
}

export interface LineLayout {
  text: string;
  m: LineMetrics;
  /** cap height used (mm) */
  size: number;
  vBaseline: number;
  /** arc offset of the line centre from the plate centre, measured at the baseline */
  offset: number;
  /** width along the baseline (mm) */
  width: number;
}

export interface DecoLayout {
  /** distance from the plate edge to the inside of the border (0 = no border) */
  borderClear: number;
  /** icon art width (mm), 0 = none */
  iconW: number;
  /** gap between plate end (or border) and an end-cap */
  edgePad: number;
  rivet?: { radius: number; inset: number };
}

export interface LayoutPlan {
  map: RimMap;
  /** core rectangle (text area + margins); the outline may extend past it by `ext` */
  rect: PlateRect;
  ext: number;
  margin: number;
  lines: LineLayout[];
  deco: DecoLayout;
  font: LoadedFont;
  /** line 1 text (as laid out) */
  text: string;
  /** line 1 baseline */
  vBaseline: number;
  fit: FitInfo;
  warnings: BuildWarning[];
}

const dblGap = (w: number) => Math.max(0.25, w);
export const beadRadius = (w: number) => Math.max(0.2, w / 2);

function decoLayout(design: Design, icon: IconArt | null): DecoLayout & { margin: number } {
  const { border, endCaps } = design.style;
  let borderClear = 0;
  if (border.type === 'single') borderClear = border.inset + border.width;
  else if (border.type === 'double')
    borderClear = border.inset + 2 * border.width + dblGap(border.width);
  else if (border.type === 'beaded') borderClear = border.inset + 2 * beadRadius(border.width);
  const edgePad = Math.max(0.5, borderClear ? borderClear + 0.2 : 0);
  let margin = Math.max(design.plate.padding, borderClear ? borderClear + 0.25 : 0);
  let iconW = 0;
  let rivet: DecoLayout['rivet'];
  if (endCaps.icon === 'rivet') {
    const radius = endCaps.size / 2;
    const inset = Math.max(edgePad + radius, radius + 0.63);
    rivet = { radius, inset };
    margin = Math.max(margin, inset + radius + 0.25);
  } else if (icon && icon.shapes.length) {
    iconW = endCaps.size * icon.aspect;
    margin = Math.max(margin, edgePad + iconW + 0.5);
  }
  return { borderClear, iconW, edgePad, rivet, margin };
}

/** Everything that doesn't need wasm: sizes, fit, placement. */
export function planLayout(
  design: Design,
  font: LoadedFont,
  icon: IconArt | null = null,
): LayoutPlan {
  const warnings: BuildWarning[] = [];
  const { text: t, plate: p, style: st } = design;
  const map = createBaseMap(resolveBase(design.base), p.angleDeg);
  const slant = map.slant;
  const round = map.kind === 'cone' || map.kind === 'cylinder';

  const norm = (s: string) => (t.uppercase ? s.toUpperCase() : s).trim();
  const text1 = norm(t.line1);
  const text2 = norm(t.line2);
  const m1 = measureLine(font, text1);
  const m2 = text2 ? measureLine(font, text2) : null;
  const missing = [...new Set([...m1.missing, ...(m2?.missing ?? [])])];
  if (missing.length) {
    warnings.push({
      level: 'warn',
      code: 'missing-glyphs',
      message: `Font has no glyph for: ${missing.join(' ')}`,
    });
  }

  const deco = decoLayout(design, icon);
  const margin = deco.margin;

  // ---- vertical placement -------------------------------------------------------------
  const gapOf = (s1: number) => 0.25 * s1 + 0.3;
  const blockH = (k: number) => t.size1 * k + (m2 ? gapOf(t.size1 * k) + t.size2 * k : 0);
  const vClear = 0.35 + deco.borderClear;
  let height = p.height;
  if (m2) {
    const need = blockH(1) + 2 * vClear;
    if (height < need - 1e-6 && !p.blend) {
      warnings.push({
        level: 'info',
        code: 'plate-grown',
        message: `Plate grown to ${need.toFixed(1)} mm to fit two lines`,
      });
      height = need;
    }
  }
  let vBottom: number;
  let vTop: number;
  if (p.blend) {
    vBottom = 0;
    vTop = slant;
  } else if (p.lip.on && round) {
    vTop = slant;
    vBottom = slant - height;
  } else {
    const vMid0 = slant / 2 + p.offsetY;
    vBottom = vMid0 - height / 2;
    vTop = vMid0 + height / 2;
    // never hang below the base (that's the table): a plate taller than the rim stands up instead
    if (vBottom < 0) {
      vTop -= vBottom;
      vBottom = 0;
    }
  }
  if (p.lip.on && !round) {
    warnings.push({
      level: 'info',
      code: 'lip-unsupported',
      message: 'Top lip is only available on round bases for now',
    });
  }
  const vMid = (vBottom + vTop) / 2;
  const h = vTop - vBottom;
  if (!p.blend && vTop > slant + 0.01) {
    warnings.push({
      level: 'info',
      code: 'plate-off-rim',
      message: `Plate (${h.toFixed(1)} mm) is taller than the ${slant.toFixed(1)} mm rim: it stands above the base top`,
    });
  }
  const ext = outlineExtension(st.outline, h);

  // ---- available width ------------------------------------------------------------------
  const capFull = map.scaleArc(map.maxArc(vTop), vTop, vMid);
  let full: number;
  if (p.width.mode === 'mm') full = p.width.value;
  else if (p.width.mode === 'deg') full = map.arcForDeg(p.width.value, vMid);
  else full = map.arcForDeg(p.maxDeg, vMid);
  if (full > capFull + 1e-6) {
    if (p.width.mode !== 'auto') {
      warnings.push({
        level: 'warn',
        code: 'too-wide',
        message:
          map.kind === 'plane'
            ? 'Plate is wider than this side of the base; trimmed to fit'
            : 'Plate is longer than the rim allows; trimmed',
      });
    }
    full = capFull;
  }
  const coreMax = Math.max(1, full - 2 * ext);
  const availableAt = (vb: number) => Math.max(0, map.scaleArc(coreMax - 2 * margin, vMid, vb));

  // ---- sizes (auto-shrink scales both lines together) ------------------------------------
  const specs = [{ m: m1, size: t.size1 }, ...(m2 ? [{ m: m2, size: t.size2 }] : [])];
  const baselines = (k: number): number[] => {
    const B = blockH(k);
    return m2 ? [vMid + B / 2 - t.size1 * k, vMid - B / 2] : [vMid - (t.size1 * k) / 2];
  };
  const widthsAt = (k: number) => specs.map((s) => lineWidth(font, s.m, s.size * k, t.spacing));
  const fitsAt = (k: number) => {
    const bs = baselines(k);
    return widthsAt(k).every((w, i) => w <= availableAt(bs[i]) + 1e-6);
  };
  // vertical room: inside the border (if any), or the plate with a small edge
  const vRoom = h - 2 * (deco.borderClear > 0 ? deco.borderClear + 0.15 : 0.15);
  const kV = vRoom > 0 ? vRoom / blockH(1) : 0;
  const fitsV = kV >= 1 - 1e-6;
  const fits = fitsAt(1);
  let k = 1;
  const hasGlyphs = specs.some((s) => s.m.glyphs.length > 0);
  if ((!fits || !fitsV) && t.autoShrink && hasGlyphs) {
    for (let it = 0; it < 4; it++) {
      const bs = baselines(k);
      let next = kV;
      specs.forEach((s, i) => {
        if (s.m.glyphs.length === 0) return;
        next = Math.min(next, sizeForWidth(font, s.m, availableAt(bs[i]), t.spacing) / s.size);
      });
      k = next;
    }
    k = Math.max(MIN_SHRINK_SIZE / t.size1, Math.min(1, k));
  }
  const shrunk = k < 1 - 1e-6;
  const bs = baselines(k);
  const widths = widthsAt(k);

  // capacity: how many characters of this average width fit at the requested size (line 1)
  const widthReq = lineWidth(font, m1, t.size1, t.spacing);
  const availReq = availableAt(baselines(1)[0]);
  const perChar =
    m1.chars > 0 && widthReq > 0 ? widthReq / m1.chars : t.size1 * 0.8 + t.spacing || 1;
  const capacity = Math.max(0, Math.floor((availReq + t.spacing) / perChar));

  // ---- plate (core) width, measured on the mid-height circle ------------------------------
  let coreMid: number;
  if (p.width.mode === 'auto') {
    const textMid = Math.max(0, ...widths.map((w, i) => map.scaleArc(w, bs[i], vMid)));
    const minCore = 2 * margin + Math.max(2, h * 0.6);
    coreMid = Math.min(Math.max(minCore, textMid + 2 * margin), Math.max(1, capFull - 2 * ext));
  } else {
    coreMid = coreMax;
    if (widths.some((w, i) => w > availableAt(bs[i]) + 1e-6)) {
      warnings.push({
        level: 'warn',
        code: 'clipped',
        message: 'Text is wider than the fixed plate and will be cut off',
      });
    }
  }
  const stillTooWide = widths.some((w, i) => w > availableAt(bs[i]) + 1e-3);
  if (!fits && (!shrunk || stillTooWide) && p.width.mode === 'auto') {
    warnings.push({
      level: 'warn',
      code: 'overflow',
      message: shrunk
        ? `Text doesn't fit even at ${MIN_SHRINK_SIZE} mm: shorten it or allow a wider plate`
        : 'Text is longer than the max plate width',
    });
  } else if (!fits && !shrunk && p.width.mode !== 'auto') {
    warnings.push({ level: 'warn', code: 'overflow', message: 'Text is too long for this plate' });
  }

  // ---- alignment --------------------------------------------------------------------------
  const lines: LineLayout[] = specs.map((s, i) => {
    const availHalf = map.scaleArc(coreMid - 2 * margin, vMid, bs[i]) / 2;
    const slack = Math.max(0, availHalf - widths[i] / 2);
    const offset = t.align === 'left' ? -slack : t.align === 'right' ? slack : 0;
    return {
      text: i === 0 ? text1 : text2,
      m: s.m,
      size: s.size * k,
      vBaseline: bs[i],
      offset,
      width: widths[i],
    };
  });

  // exact floor (k · size1 can land a hair under MIN_SHRINK_SIZE)
  const size = Math.min(t.size1, Math.max(MIN_SHRINK_SIZE, t.size1 * k));
  lines[0].size = size;
  if (text1.length > 0) {
    if (size < MIN_READABLE_SIZE) {
      warnings.push({
        level: 'warn',
        code: 'too-small',
        message: `Letters ${size.toFixed(1)} mm: very hard to read`,
      });
    } else if (size < READABLE_SIZE) {
      warnings.push({
        level: 'warn',
        code: 'readability',
        message: `Letters ${size.toFixed(1)} mm: readable, consider ${READABLE_SIZE.toFixed(1)}+`,
      });
    }
  }
  if (m2 && t.size2 * k < 1.5) {
    warnings.push({
      level: 'info',
      code: 'line2-small',
      message: `Line 2 is only ${(t.size2 * k).toFixed(1)} mm tall`,
    });
  }
  if (deco.borderClear > 0 && blockH(k) > vRoom + 1e-6) {
    warnings.push({
      level: 'info',
      code: 'border-touch',
      message: 'Letters touch the border: raise the plate or lower the letters',
    });
  }
  if (map.kind === 'oval' && coreMid + 2 * ext > 0.3 * map.arcForDeg(360, vMid)) {
    warnings.push({
      level: 'info',
      code: 'oval-curve',
      message: 'Long plate on an oval: the fit round the tight ends is approximate',
    });
  }

  return {
    map,
    rect: { halfU: coreMid / 2, vBottom, vTop, refV: vMid },
    ext,
    margin,
    lines,
    deco,
    font,
    text: text1,
    vBaseline: bs[0],
    fit: {
      chars: m1.chars,
      capacity,
      fits,
      fitsHeight: fitsV,
      sizeUsed: size,
      size2Used: m2 ? t.size2 * k : 0,
      shrunk,
      textWidth: widthReq,
      available: availReq,
    },
    warnings,
  };
}

/** Keep only the biggest connected region (drops slivers and loose islands). */
function largestPiece(cs: CrossSection, scope: Scope): CrossSection {
  const pieces = cs.decompose();
  if (pieces.length <= 1) {
    pieces.forEach((p) => p.delete());
    return cs;
  }
  let best = 0;
  let bestArea = -1;
  pieces.forEach((p, i) => {
    const a = p.area();
    if (a > bestArea) {
      bestArea = a;
      best = i;
    }
  });
  pieces.forEach((p, i) => (i === best ? scope.add(p) : p.delete()));
  return pieces[best];
}

function normaliseOptions(o: Quality | BuildOptions | undefined): Required<BuildOptions> {
  const base = typeof o === 'string' ? { quality: o } : (o ?? {});
  return {
    quality: base.quality ?? 'preview',
    printer: base.printer ?? 'resin',
    parts: base.parts ?? false,
    withBase: base.withBase ?? false,
    strokeCheck: base.strokeCheck ?? true,
  };
}

function glyphChar(m: LineMetrics, i: number, text: string): string {
  const g = m.glyphs[i] as unknown as { unicode?: number };
  if (typeof g.unicode === 'number') return String.fromCodePoint(g.unicode);
  return [...text][i] ?? '?';
}

/** Extract mesh arrays (+ painted triangle ranges) from a manifold. */
function meshOf(solid: Manifold, paintIds: Set<number>): MeshData {
  const mesh = solid.getMesh();
  const np = mesh.numProp;
  const nVerts = mesh.vertProperties.length / np;
  const positions = new Float32Array(nVerts * 3);
  for (let i = 0; i < nVerts; i++) {
    positions[i * 3] = mesh.vertProperties[i * np];
    positions[i * 3 + 1] = mesh.vertProperties[i * np + 1];
    positions[i * 3 + 2] = mesh.vertProperties[i * np + 2];
  }
  const indices = new Uint32Array(mesh.triVerts);
  const paint: Array<[number, number]> = [];
  const runIndex = mesh.runIndex;
  const runIds = mesh.runOriginalID;
  if (runIndex && runIds) {
    for (let r = 0; r < runIds.length; r++) {
      if (!paintIds.has(runIds[r])) continue;
      const start = runIndex[r] / 3;
      const end = (runIndex[r + 1] ?? indices.length) / 3;
      if (end > start) paint.push([start, end - start]);
    }
  }
  return { positions, indices, paint };
}

export async function buildPlate(
  wasm: ManifoldToplevel,
  fonts: FontProvider,
  design: Design,
  options?: Quality | BuildOptions,
): Promise<BuildResult> {
  const opt = normaliseOptions(options);
  const t0 = performance.now();
  const fontEntry = findFont(design.text.fontId);
  const font = await fonts.get(fontEntry ? fontEntry.id : design.text.fontId);
  const iconId = design.style.endCaps.icon;
  let art: IconArt | null = null;
  const preWarnings: BuildWarning[] = [];
  if (iconId !== 'none' && iconId !== 'rivet') {
    art = fonts.icon ? await fonts.icon(iconId) : null;
    if (!art || !art.shapes.length) {
      preWarnings.push({
        level: 'info',
        code: 'icon-missing',
        message: art?.warnings[0] ?? 'End-cap artwork could not be loaded',
      });
      art = null;
    }
  }
  const plan = planLayout(design, font, art);
  const { map, rect, deco } = plan;
  const { CrossSection, Manifold } = wasm;
  const st = design.style;
  const mode = design.text.mode;
  const T = design.plate.thickness;
  const D = design.text.depth;
  const gap = opt.withBase ? -0.05 : design.plate.gap;
  const tol = opt.quality === 'export' ? 0.005 : 0.01;
  const minFeature = MIN_FEATURE[opt.printer];
  const warnings: BuildWarning[] = [...preWarnings, ...plan.warnings];
  const scope = new Scope();
  const cs = (polys: Vec2[][], rule: 'NonZero' | 'EvenOdd' = 'NonZero') =>
    scope.add(new CrossSection(polys, rule));

  try {
    // ---- 2D: plate outline ----------------------------------------------------------------
    const outlineUV = outlinePolygon(st.outline, rect, design.plate.cornerRadius);
    let plate2D = cs([bendPolygon(map, outlineUV, rect.refV)]);
    plate2D = largestPiece(plate2D, scope);

    // fire-arc notches in the top edge
    if (design.extras.fireArc) {
      const half = design.extras.fireArc / 2;
      const uTop = map.scaleArc(map.arcForDeg(half, rect.vTop), rect.vTop, rect.refV);
      const reach = rect.halfU + plan.ext - 0.6;
      if (uTop > reach) {
        warnings.push({
          level: 'info',
          code: 'fire-arc-outside',
          message: `The ${design.extras.fireArc}° arc edges fall outside the plate: widen it to show them`,
        });
      } else {
        const notches = [-uTop, uTop].map((u) =>
          bendPolygon(
            map,
            [
              [u - 0.45, rect.vTop + 0.1],
              [u, rect.vTop - 0.6],
              [u + 0.45, rect.vTop + 0.1],
            ],
            rect.refV,
            0.1,
          ),
        );
        plate2D = scope.add(plate2D.subtract(cs(notches)));
      }
    }
    const plateFull2D = plate2D;

    // ---- 2D: text -------------------------------------------------------------------------
    let text2D: CrossSection | null = null;
    const thinChars: string[] = [];
    const glyphSets = plan.lines.flatMap((ln) =>
      layoutGlyphsOnArc(
        font,
        ln.m,
        ln.size,
        design.text.spacing,
        map,
        ln.vBaseline,
        tol,
        ln.offset,
      ).map((g) => ({ ...g, line: ln })),
    );
    if (glyphSets.length) {
      let t2 = cs(glyphSets.flatMap((g) => g.contours));
      if (design.text.thicken > 0) t2 = scope.add(t2.offset(design.text.thicken, 'Round', 2, 16));
      text2D = t2;
      if (opt.strokeCheck) {
        // erode by min/2 then grow back (mitred, so corners survive): area lost = thin strokes
        for (const g of glyphSets) {
          let gcs = cs(g.contours);
          if (design.text.thicken > 0)
            gcs = scope.add(gcs.offset(design.text.thicken, 'Round', 2, 16));
          const a0 = gcs.area();
          if (a0 <= 1e-6) continue;
          const opened = scope.add(
            scope.add(gcs.offset(-minFeature / 2, 'Miter', 4)).offset(minFeature / 2, 'Miter', 4),
          );
          // serifs and hairlines lose a little; a glyph whose main strokes are too thin loses a lot
          const lost = (a0 - opened.area()) / a0;
          if (lost > STROKE_LOSS) thinChars.push(glyphChar(g.line.m, g.index, g.line.text));
        }
      }
    }
    if (thinChars.length) {
      warnings.push({
        level: 'warn',
        code: 'thin-strokes',
        message: `Strokes thinner than ${minFeature} mm in: ${[...new Set(thinChars)].join(' ')}`,
      });
    }

    // ---- 2D: border + icons -----------------------------------------------------------------
    const decoParts: CrossSection[] = [];
    const { border } = st;
    const ring = (from: number, width: number) =>
      scope.add(
        scope
          .add(plateFull2D.offset(-from, 'Miter', 2))
          .subtract(scope.add(plateFull2D.offset(-(from + width), 'Miter', 2))),
      );
    if (border.type === 'single') decoParts.push(ring(border.inset, border.width));
    if (border.type === 'double') {
      decoParts.push(ring(border.inset, border.width));
      decoParts.push(ring(border.inset + border.width + dblGap(border.width), border.width));
    }
    if (border.type === 'beaded') {
      const rb = beadRadius(border.width);
      const path = scope.add(plateFull2D.offset(-(border.inset + rb), 'Round', 2, 16));
      const beads: Vec2[][] = [];
      const spacing = 2.5 * rb;
      for (const poly of path.toPolygons()) {
        let carry = 0;
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i];
          const b = poly[(i + 1) % poly.length];
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          let s = carry;
          while (s < len) {
            const x = a[0] + ((b[0] - a[0]) * s) / len;
            const y = a[1] + ((b[1] - a[1]) * s) / len;
            beads.push(
              Array.from({ length: 12 }, (_, j): Vec2 => {
                const ang = (2 * Math.PI * j) / 12;
                return [x + rb * Math.cos(ang), y + rb * Math.sin(ang)];
              }),
            );
            s += spacing;
          }
          carry = s - len;
        }
      }
      if (beads.length) decoParts.push(cs(beads));
    }
    if (border.type !== 'none' && border.width < minFeature - 1e-6) {
      warnings.push({
        level: 'info',
        code: 'thin-border',
        message: `Border ${border.width.toFixed(2)} mm is under the ${minFeature} mm printer minimum`,
      });
    }

    if (art && deco.iconW > 0) {
      const size = st.endCaps.size;
      const ln = plan.lines[0];
      const vC = plan.lines.length > 1 ? rect.refV : ln.vBaseline + ln.size / 2;
      for (const s of [-1, 1]) {
        let uRef: number;
        if (st.endCaps.place === 'beside' && ln.width > 0) {
          const centre = map.scaleArc(ln.offset, ln.vBaseline, rect.refV);
          const halfW = Math.max(
            ...plan.lines.map((l) => map.scaleArc(l.width / 2, l.vBaseline, rect.refV)),
          );
          uRef = centre + s * (halfW + 0.5 + deco.iconW / 2);
        } else {
          uRef = s * (rect.halfU - deco.edgePad - deco.iconW / 2);
        }
        const frame = map.frameAt(map.scaleArc(uRef, rect.refV, vC), vC);
        for (const sh of placeIcon(art, size, s > 0, frame)) {
          decoParts.push(cs(sh.contours, sh.fillRule));
        }
      }
    }

    // ---- mode-specific 2D ------------------------------------------------------------------
    let cutter2D: CrossSection | null = null;
    let inlay2D: CrossSection | null = null;
    const raised2DParts = [...decoParts];
    if (text2D && mode === 'raised') raised2DParts.push(text2D);
    if (text2D && mode === 'engraved') {
      cutter2D = scope.add(text2D.intersect(scope.add(plateFull2D.offset(-0.15, 'Miter', 2))));
      inlay2D = cutter2D;
    }
    if (text2D && mode === 'cut') {
      inlay2D = scope.add(text2D.intersect(plateFull2D));
      const cutAll = scope.add(plateFull2D.subtract(text2D));
      const loose = cutAll.decompose().map((x) => x.delete()).length - 1;
      const cut = largestPiece(cutAll, scope);
      if (loose > 0) {
        warnings.push({
          level: 'info',
          code: 'cut-islands',
          message: `${loose} loose letter centre${loose > 1 ? 's' : ''} (as in O, A) removed: they would fall out`,
        });
      }
      plate2D = cut;
    }
    let Deng = D;
    if (mode === 'engraved' && D > T - 0.3) {
      Deng = Math.max(0.1, T - 0.3);
      warnings.push({
        level: 'info',
        code: 'engrave-depth',
        message: `Engraving limited to ${Deng.toFixed(2)} mm so the plate keeps 0.3 mm behind it`,
      });
    }

    // ---- 3D ---------------------------------------------------------------------------------
    const paintIds = new Set<number>();
    const mark = (m: Manifold, paint: boolean) => {
      const o = scope.add(m.asOriginal());
      if (paint) paintIds.add(o.originalID());
      return o;
    };
    let body = mark(scope.add(plate2D.extrude(T)), false);
    let cutter3: Manifold | null = null;
    if (cutter2D && !cutter2D.isEmpty()) {
      cutter3 = mark(
        scope.add(scope.add(cutter2D.extrude(Deng + EPS)).translate([0, 0, T - Deng])),
        true,
      );
      body = scope.add(body.subtract(cutter3));
    }

    const domes = (start: number): Manifold[] => {
      const out: Manifold[] = [];
      if (!deco.rivet) return out;
      const { radius } = deco.rivet;
      const domeH = Math.max(0.25, Math.min(D + 0.05, radius * 1.1));
      for (const [u, v] of rivetCentres(rect, deco.rivet)) {
        const [X, Y] = map.bend(u, v, rect.refV);
        out.push(
          scope.add(
            scope
              .add(
                scope
                  .add(scope.add(Manifold.sphere(radius, 24)).scale([1, 1, domeH / radius]))
                  .translate([X, Y, T]),
              )
              .trimByPlane([0, 0, 1], start),
          ),
        );
      }
      return out;
    };

    const detailSolids: Manifold[] = [];
    if (raised2DParts.length) {
      const raised = scope.add(scope.add(CrossSection.union(raised2DParts)).intersect(plate2D));
      if (!raised.isEmpty()) {
        detailSolids.push(scope.add(scope.add(raised.extrude(D + EPS)).translate([0, 0, T - EPS])));
      }
    }
    detailSolids.push(...domes(T - EPS));
    let printed = body;
    if (detailSolids.length) {
      const details = mark(scope.add(Manifold.union(detailSolids)), true);
      printed = scope.add(Manifold.union([body, details]));
    }

    // ---- warp onto the rim ------------------------------------------------------------------
    const surface: SurfaceType = st.surface;
    const textured = surface !== 'smooth';
    const blend = design.plate.blend;
    const refineLen =
      opt.quality === 'export' ? (textured ? 0.2 : 0.25) : textured || blend ? 0.3 : 0.4;
    const uMax = rect.halfU + plan.ext;
    const bevel = Math.min(1.2, (rect.vTop - rect.vBottom) / 3);
    const tMin = Math.min(0.15, T);
    const warpFn = (verts: Float64Array | number[], count: number) => {
      for (let i = 0; i < count; i++) {
        const o = i * 3;
        const X = verts[o];
        const Y = verts[o + 1];
        let z = verts[o + 2];
        if (textured && Math.abs(z - T) < 1e-4) z -= surfaceDepth(surface, X, Y);
        if (blend && z > 1e-9) {
          const [u, v] = map.unbend(X, Y, rect.refV);
          const dist = Math.min(v - rect.vBottom, rect.vTop - v, uMax - Math.abs(u));
          const f = tMin / T + (1 - tMin / T) * Math.min(1, Math.max(0, dist / bevel));
          z = z <= T + 1e-6 ? z * f : z - T * (1 - f);
        }
        const P = map.toWorld(X, Y, z + gap);
        verts[o] = P[0];
        verts[o + 1] = P[1];
        verts[o + 2] = P[2];
      }
    };
    const warpSolid = (m: Manifold) =>
      scope.add(scope.add(m.refineToLength(refineLen)).warpBatch(warpFn));

    let finalSolid = warpSolid(printed);

    // ---- top lip (world space) ----------------------------------------------------------------
    const lipSolid = (): Manifold | null => {
      if (!design.plate.lip.on || (map.kind !== 'cone' && map.kind !== 'cylinder')) return null;
      const { Rb, Rt, H } = map.frustum;
      const s = map.slant;
      const kk = (Rb - Rt) / s; // slope
      const nr = H / s;
      const nz = kk;
      const g = Math.max(gap, 0);
      const { depth, thickness } = design.plate.lip;
      const down = 0.5;
      const prof: Vec2[] = [[Rt - depth, H + g]];
      prof.push([Rt, H + g]);
      if (g > 0.01) {
        const a0 = Math.PI / 2;
        const a1 = Math.atan2(nz, nr);
        for (let i = 1; i < 6; i++) {
          const a = a0 + ((a1 - a0) * i) / 6;
          prof.push([Rt + g * Math.cos(a), H + g * Math.sin(a)]);
        }
      }
      prof.push([Rt + g * nr + down * kk, H + g * nz - down * nr]);
      prof.push([Rt + (g + T) * nr + down * kk, H + (g + T) * nz - down * nr]);
      const zTop = Math.max(H + g + thickness, H + (g + T) * nz + 0.2);
      prof.push([Rt + (g + T) * nr, zTop]);
      prof.push([Rt - depth, zTop]);
      const cornerTrim = (design.plate.cornerRadius + 0.3) / Rt;
      const halfAng = rect.halfU / map.radiusAt(rect.refV) - cornerTrim;
      if (halfAng <= 0.02) return null;
      const deg = (2 * halfAng * 180) / Math.PI;
      const segs = Math.max(24, Math.ceil((2 * Math.PI * Rt) / 0.4));
      const rev = scope.add(Manifold.revolve(cs([prof]), segs, deg));
      const startStd = map.angle - halfAng - Math.PI / 2; // azimuth -> standard angle
      return scope.add(rev.rotate([0, 0, (startStd * 180) / Math.PI]));
    };
    const lip = lipSolid();
    if (lip) finalSolid = scope.add(Manifold.union([finalSolid, lip]));

    if (opt.withBase) {
      const b = scope.add(baseSolid(wasm, resolveBase(design.base)));
      finalSolid = scope.add(Manifold.union([finalSolid, b]));
    }

    // ---- separate parts (3MF) -----------------------------------------------------------------
    let parts: BuildResult['parts'];
    if (opt.parts) {
      let plateOnly = warpSolid(body);
      if (lip) plateOnly = scope.add(Manifold.union([plateOnly, lip]));
      const detailOnly: Manifold[] = [];
      const decoOnly = decoParts.length
        ? scope.add(scope.add(CrossSection.union(decoParts)).intersect(plate2D))
        : null;
      if (mode === 'raised') {
        const all = [...decoParts, ...(text2D ? [text2D] : [])];
        if (all.length) {
          const r2 = scope.add(scope.add(CrossSection.union(all)).intersect(plate2D));
          if (!r2.isEmpty())
            detailOnly.push(scope.add(scope.add(r2.extrude(D)).translate([0, 0, T])));
        }
      } else {
        if (decoOnly && !decoOnly.isEmpty()) {
          detailOnly.push(scope.add(scope.add(decoOnly.extrude(D)).translate([0, 0, T])));
        }
        if (inlay2D && !inlay2D.isEmpty()) {
          const zb = mode === 'engraved' ? T - Deng : 0;
          const hgt = mode === 'engraved' ? Deng : T;
          detailOnly.push(scope.add(scope.add(inlay2D.extrude(hgt)).translate([0, 0, zb])));
        }
      }
      detailOnly.push(...domes(T));
      const details = detailOnly.length ? warpSolid(scope.add(Manifold.union(detailOnly))) : null;
      parts = {
        plate: meshOf(plateOnly, new Set()),
        details: details ? meshOf(details, new Set()) : null,
      };
    }

    // ---- checks + mesh ------------------------------------------------------------------------
    const status = finalSolid.status();
    const volume = finalSolid.volume();
    const genus = finalSolid.genus();
    const pieces = finalSolid.decompose();
    const components = pieces.length;
    pieces.forEach((x) => x.delete());
    const watertight = status === 'NoError' && volume > 0 && !finalSolid.isEmpty();
    if (!watertight) {
      warnings.push({ level: 'error', code: 'not-watertight', message: `Mesh problem: ${status}` });
    }
    if (opt.printer === 'fdm' && (T < 1.0 || (mode === 'raised' && D < 0.4))) {
      warnings.push({
        level: 'info',
        code: 'fdm-thin',
        message: 'For FDM, use a plate ≥ 1.0 mm and text ≥ 0.4 mm deep',
      });
    }

    const mesh = meshOf(finalSolid, paintIds);
    const box = finalSolid.boundingBox();
    const plateWidth = 2 * (rect.halfU + plan.ext);
    const raisedAny = (mode === 'raised' && glyphSets.length > 0) || detailSolids.length > 0;
    const normal = map.normalAt(0);

    return {
      mesh,
      parts,
      fit: plan.fit,
      warnings,
      normal,
      stats: {
        status,
        watertight,
        components,
        genus,
        volume,
        triangles: mesh.indices.length / 3,
        bbox: {
          min: [...box.min] as [number, number, number],
          max: [...box.max] as [number, number, number],
        },
        plate: {
          width: plateWidth,
          height: rect.vTop - rect.vBottom,
          thickness: T + (raisedAny ? D : 0),
          degrees: map.arcToDeg(plateWidth, rect.refV),
        },
        buildMs: performance.now() - t0,
      },
    };
  } finally {
    scope.dispose();
  }
}
