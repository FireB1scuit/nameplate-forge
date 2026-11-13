/**
 * Top-level geometry pipeline (plan.md §5.3, §5.6). Pure: takes the manifold wasm module and a
 * font provider, so it runs in the Web Worker and in Node (Vitest) alike.
 *
 *   plate2D  = outline (bent into the unrolled rim)            — rounded via offset(−r)/offset(+r)
 *   raised2D = (text glyphs on the baseline arc ∪ border ring) ∩ plate2D
 *   solid    = extrude(plate2D, T) ∪ translateZ(extrude(raised2D, D), T) ∪ rivets
 *   solid    = warp(refineToLength(solid))  onto the rim, offset by the fit gap
 */
import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d';
import { getTheme } from '../data/themes';
import { findFont } from '../data/fonts';
import { resolveFrustum, type Design } from '../state/schema';
import { createRimMap, degToArc, type RimMap, type Vec2 } from './conemap';
import { rectOutline, rivetCentres, type PlateRect } from './outline';
import { layoutLineOnArc, lineWidth, measureLine, sizeForWidth, type LoadedFont } from './text';

export type Quality = 'preview' | 'export';

export interface FontProvider {
  get(fontId: string): Promise<LoadedFont>;
}

export interface FitInfo {
  /** characters in line 1 (including spaces) */
  chars: number;
  /** estimated characters that fit at the requested letter height */
  capacity: number;
  /** text fits at the requested size without shrinking */
  fits: boolean;
  /** letter height actually used (after auto-shrink) */
  sizeUsed: number;
  shrunk: boolean;
  /** measured text width at the requested size (mm, along the baseline) */
  textWidth: number;
  /** text width available (mm, along the baseline) */
  available: number;
}

export type WarningCode =
  | 'readability'
  | 'too-small'
  | 'overflow'
  | 'clipped'
  | 'missing-glyphs'
  | 'border-touch'
  | 'plate-off-rim'
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
}

export interface BuildResult {
  mesh: MeshData;
  stats: BuildStats;
  fit: FitInfo;
  warnings: BuildWarning[];
}

/** Below this letter height the print check warns about readability. */
export const READABLE_SIZE = 3.0;
export const MIN_READABLE_SIZE = 2.0;
/** Auto-shrink never goes below this. */
export const MIN_SHRINK_SIZE = 1.5;
/** Never let a plate wrap more than this much of the rim. */
const MAX_PLATE_DEG = 330;
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

export interface LayoutPlan {
  map: RimMap;
  rect: PlateRect;
  vBaseline: number;
  font: LoadedFont;
  text: string;
  fit: FitInfo;
  warnings: BuildWarning[];
}

/** Everything that doesn't need wasm: sizes, fit, placement. */
export function planLayout(design: Design, font: LoadedFont): LayoutPlan {
  const warnings: BuildWarning[] = [];
  const { text: t, plate: p } = design;
  const theme = getTheme(design.style.themeId);
  const map = createRimMap(resolveFrustum(design.base), p.angleDeg);
  const slant = map.slant;

  const text = (t.uppercase ? t.line1.toUpperCase() : t.line1).trim();
  const m = measureLine(font, text);
  if (m.missing.length) {
    warnings.push({
      level: 'warn',
      code: 'missing-glyphs',
      message: `Font has no glyph for: ${[...new Set(m.missing)].join(' ')}`,
    });
  }

  // vertical placement: plate centred on the slant (+ offset), caps centred on the plate
  const vMid = slant / 2 + p.offsetY;
  const vBottom = vMid - p.height / 2;
  const vTop = vMid + p.height / 2;
  if (vBottom < -0.01 || vTop > slant + 0.01) {
    warnings.push({
      level: 'info',
      code: 'plate-off-rim',
      message: `Plate (${p.height.toFixed(1)} mm) extends past the ${slant.toFixed(1)} mm rim slope`,
    });
  }

  // space reserved at each end between plate edge and text
  let margin = p.padding;
  if (theme.rivets) margin = Math.max(margin, theme.rivets.inset + theme.rivets.radius + 0.25);
  if (theme.border) margin = Math.max(margin, theme.border.inset + theme.border.width + 0.25);

  const sizeReq = t.size1;
  const vBaseOf = (size: number) => vMid - size / 2;

  // available text width, measured along the baseline circle
  const maxPlateMid =
    p.width.mode === 'mm' ? p.width.value : degToArc(map, Math.min(p.maxDeg, MAX_PLATE_DEG), vMid);
  const availableAt = (vb: number) => Math.max(0, map.scaleArc(maxPlateMid - 2 * margin, vMid, vb));

  const widthReq = lineWidth(font, m, sizeReq, t.spacing);
  const availReq = availableAt(vBaseOf(sizeReq));
  const fits = widthReq <= availReq + 1e-6;

  let size = sizeReq;
  if (!fits && t.autoShrink && m.glyphs.length > 0) {
    // width is linear in size (spacing is fixed); availability barely depends on the baseline
    // height, so two fixed-point steps converge to well under 0.01 mm
    for (let i = 0; i < 3; i++) {
      size = sizeForWidth(font, m, availableAt(vBaseOf(size)), t.spacing);
    }
    size = Math.max(MIN_SHRINK_SIZE, Math.min(sizeReq, size));
  }
  const shrunk = size < sizeReq - 1e-6;
  const vBaseline = vBaseOf(size);
  const width = lineWidth(font, m, size, t.spacing);

  // capacity: how many characters of this average width fit at the requested size
  const perChar = m.chars > 0 && widthReq > 0 ? widthReq / m.chars : sizeReq * 0.8 + t.spacing || 1;
  const capacity = Math.max(0, Math.floor((availReq + t.spacing) / perChar));

  // plate width (measured on the mid-height circle)
  let plateMid: number;
  if (p.width.mode === 'mm') {
    plateMid = p.width.value;
    if (width > availableAt(vBaseline) + 1e-6) {
      warnings.push({
        level: 'warn',
        code: 'clipped',
        message: 'Text is wider than the fixed plate and will be cut off',
      });
    }
  } else {
    const textMid = map.scaleArc(width, vBaseline, vMid);
    const minPlate = 2 * margin + Math.max(4, p.height);
    plateMid = Math.max(minPlate, textMid + 2 * margin);
    const cap = degToArc(map, MAX_PLATE_DEG, vMid);
    if (plateMid > cap) plateMid = cap;
  }
  const stillTooWide = width > availableAt(vBaseline) + 1e-3;
  if (!fits && (!shrunk || stillTooWide)) {
    warnings.push({
      level: 'warn',
      code: 'overflow',
      message:
        p.width.mode === 'mm'
          ? 'Text is too long for this plate'
          : shrunk
            ? `Text doesn't fit even at ${MIN_SHRINK_SIZE} mm: shorten it or allow a wider plate`
            : 'Text is longer than the max plate width',
    });
  }

  if (text.length > 0) {
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
  if (theme.border && size > p.height - 2 * (theme.border.inset + theme.border.width + 0.15)) {
    warnings.push({
      level: 'info',
      code: 'border-touch',
      message: 'Letters touch the border: raise the plate or lower the letters',
    });
  }

  return {
    map,
    rect: { halfU: plateMid / 2, vBottom, vTop, refV: vMid },
    vBaseline,
    font,
    text,
    fit: {
      chars: m.chars,
      capacity,
      fits,
      sizeUsed: size,
      shrunk,
      textWidth: widthReq,
      available: availReq,
    },
    warnings,
  };
}

export async function buildPlate(
  wasm: ManifoldToplevel,
  fonts: FontProvider,
  design: Design,
  quality: Quality = 'preview',
): Promise<BuildResult> {
  const t0 = performance.now();
  const fontEntry = findFont(design.text.fontId);
  const font = await fonts.get(fontEntry ? fontEntry.id : design.text.fontId);
  const plan = planLayout(design, font);
  const { map, rect } = plan;
  const { CrossSection, Manifold } = wasm;
  const theme = getTheme(design.style.themeId);
  const T = design.plate.thickness;
  const D = design.text.depth;
  const gap = design.plate.gap;
  const scope = new Scope();

  try {
    // ---- 2D: plate outline -------------------------------------------------------------
    let plate2D = scope.add(new CrossSection([rectOutline(map, rect)], 'NonZero'));
    if (theme.outline === 'rounded') {
      const r = Math.min(
        design.plate.cornerRadius,
        (rect.vTop - rect.vBottom) / 2 - 0.05,
        rect.halfU - 0.05,
      );
      if (r > 0.01) {
        plate2D = scope.add(
          scope.add(plate2D.offset(-r, 'Round', 2, 32)).offset(r, 'Round', 2, 32),
        );
      }
    }

    // ---- 2D: raised layer (text + border) ----------------------------------------------
    const raisedParts: CrossSection[] = [];
    if (plan.text.length > 0) {
      const contours: Vec2[][] = layoutLineOnArc(
        font,
        measureLine(font, plan.text),
        plan.fit.sizeUsed,
        design.text.spacing,
        map,
        plan.vBaseline,
        quality === 'export' ? 0.005 : 0.01,
      );
      if (contours.length) raisedParts.push(scope.add(new CrossSection(contours, 'NonZero')));
    }
    if (theme.border) {
      const outer = scope.add(plate2D.offset(-theme.border.inset, 'Miter', 2));
      const inner = scope.add(
        plate2D.offset(-(theme.border.inset + theme.border.width), 'Miter', 2),
      );
      raisedParts.push(scope.add(outer.subtract(inner)));
    }

    // ---- 3D --------------------------------------------------------------------------
    const solids: Manifold[] = [scope.add(plate2D.extrude(T))];
    if (raisedParts.length) {
      const raised = scope.add(scope.add(CrossSection.union(raisedParts)).intersect(plate2D));
      if (!raised.isEmpty()) {
        solids.push(scope.add(scope.add(raised.extrude(D + EPS)).translate([0, 0, T - EPS])));
      }
    }
    if (theme.rivets) {
      const { radius } = theme.rivets;
      const domeH = D + 0.05;
      for (const [u, v] of rivetCentres(rect, theme.rivets)) {
        const [X, Y] = map.bend(u, v, rect.refV);
        const dome = scope.add(
          scope
            .add(
              scope
                .add(scope.add(Manifold.sphere(radius, 24)).scale([1, 1, domeH / radius]))
                .translate([X, Y, T]),
            )
            .trimByPlane([0, 0, 1], T - EPS),
        );
        solids.push(dome);
      }
    }

    const united = scope.add(Manifold.union(solids));
    const refined = scope.add(united.refineToLength(quality === 'export' ? 0.25 : 0.4));
    const warped = scope.add(
      refined.warpBatch((verts, count) => {
        for (let i = 0; i < count; i++) {
          const o = i * 3;
          const P = map.toWorld(verts[o], verts[o + 1], verts[o + 2] + gap);
          verts[o] = P[0];
          verts[o + 1] = P[1];
          verts[o + 2] = P[2];
        }
      }),
    );

    // ---- checks + mesh -----------------------------------------------------------------
    const status = warped.status();
    const volume = warped.volume();
    const genus = warped.genus();
    const parts = warped.decompose();
    const components = parts.length;
    parts.forEach((x) => x.delete());
    const watertight = status === 'NoError' && volume > 0 && !warped.isEmpty();
    const warnings = [...plan.warnings];
    if (!watertight) {
      warnings.push({ level: 'error', code: 'not-watertight', message: `Mesh problem: ${status}` });
    }

    const mesh = warped.getMesh();
    const np = mesh.numProp;
    const nVerts = mesh.vertProperties.length / np;
    const positions = new Float32Array(nVerts * 3);
    for (let i = 0; i < nVerts; i++) {
      positions[i * 3] = mesh.vertProperties[i * np];
      positions[i * 3 + 1] = mesh.vertProperties[i * np + 1];
      positions[i * 3 + 2] = mesh.vertProperties[i * np + 2];
    }
    const indices = new Uint32Array(mesh.triVerts);
    const box = warped.boundingBox();
    const plateWidth = rect.halfU * 2;

    return {
      mesh: { positions, indices },
      fit: plan.fit,
      warnings,
      stats: {
        status,
        watertight,
        components,
        genus,
        volume,
        triangles: indices.length / 3,
        bbox: {
          min: [...box.min] as [number, number, number],
          max: [...box.max] as [number, number, number],
        },
        plate: {
          width: plateWidth,
          height: rect.vTop - rect.vBottom,
          thickness: T + (plan.text.length || theme.border || theme.rivets ? D : 0),
          degrees: (plateWidth / map.radiusAt(rect.refV)) * (180 / Math.PI),
        },
        buildMs: performance.now() - t0,
      },
    };
  } finally {
    scope.dispose();
  }
}
