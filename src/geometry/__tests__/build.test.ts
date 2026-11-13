import Module from 'manifold-3d';
import type { ManifoldToplevel } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { FONTS } from '../../data/fonts';
import { applyTheme, DEFAULT_DESIGN, resolveFrustum, type Design } from '../../state/schema';
import { buildPlate, planLayout } from '../build';
import { createRimMap } from '../conemap';
import { lineWidth, measureLine } from '../text';
import { nodeFontProvider } from './nodeFonts';

let wasm: ManifoldToplevel;
const fonts = nodeFontProvider();

beforeAll(async () => {
  wasm = await Module();
  wasm.setup();
});

const variant = (patch: (d: Design) => void): Design => {
  const d = structuredClone(DEFAULT_DESIGN);
  patch(d);
  return d;
};

describe('fonts', () => {
  it.each(FONTS.map((f) => f.id))('%s: cap height is sane and text has width', async (id) => {
    const f = await fonts.get(id);
    expect(f.capHeight / f.unitsPerEm).toBeGreaterThan(0.5);
    expect(f.capHeight / f.unitsPerEm).toBeLessThan(0.9);
    const w = lineWidth(f, measureLine(f, 'BROTHER KAI'), 2.8, 0.3);
    expect(w).toBeGreaterThan(12);
    expect(w).toBeLessThan(45);
  });

  it('applies the bold variation to Cinzel', async () => {
    const f = await fonts.get('cinzel');
    measureLine(f, 'H');
    const H = f.font.charToGlyph('H') as unknown as { index: number; _advanceWidth?: number };
    // opentype.js keeps the default-instance advance in _advanceWidth once HVAR is applied;
    // the bold instance is wider
    expect(H._advanceWidth).toBeDefined();
    expect(f.cache.get(H.index)!.advance).toBeGreaterThan(H._advanceWidth!);
  });
});

describe('planLayout', () => {
  it('fits the default design on a 32 mm base', async () => {
    const plan = planLayout(DEFAULT_DESIGN, await fonts.get('cinzel'));
    expect(plan.fit.fits).toBe(true);
    expect(plan.fit.chars).toBe(11);
    expect(plan.fit.capacity).toBeGreaterThanOrEqual(11);
    expect(plan.fit.sizeUsed).toBe(2.8);
  });

  it('auto-shrinks long names to the max width', async () => {
    const d = variant((d) => {
      d.text.line1 = 'BROTHER TENEBRIN MAX';
    });
    const plan = planLayout(d, await fonts.get('cinzel'));
    expect(plan.fit.fits).toBe(false);
    expect(plan.fit.shrunk).toBe(true);
    expect(plan.fit.sizeUsed).toBeLessThan(2.8);
    const map = createRimMap(resolveFrustum(d.base));
    const maxPlate = ((d.plate.maxDeg * Math.PI) / 180) * map.radiusAt(plan.rect.refV);
    expect(plan.rect.halfU * 2).toBeCloseTo(maxPlate, 1);
  });

  it('warns when even the smallest letters do not fit', async () => {
    const d = variant((d) => {
      d.text.line1 = 'BROTHER MAXIMILLIAN-AUREX OF THE THIRD';
    });
    const plan = planLayout(d, await fonts.get('cinzel'));
    expect(plan.fit.sizeUsed).toBe(1.5);
    expect(plan.warnings.map((w) => w.code)).toContain('overflow');
  });

  it('warns instead of shrinking when auto-shrink is off', async () => {
    const d = variant((d) => {
      d.text.line1 = 'BROTHER MAXIMILLIAN-AUREX';
      d.text.autoShrink = false;
    });
    const plan = planLayout(d, await fonts.get('cinzel'));
    expect(plan.fit.sizeUsed).toBe(2.8);
    expect(plan.warnings.map((w) => w.code)).toContain('overflow');
  });

  it('flags small letters', async () => {
    const plan = planLayout(DEFAULT_DESIGN, await fonts.get('cinzel'));
    expect(plan.warnings.map((w) => w.code)).toContain('readability');
  });
});

describe('buildPlate', () => {
  const cases: Array<[string, Design]> = [
    ['default (32 mm, Cinzel, plain)', DEFAULT_DESIGN],
    [
      'riveted 60 mm Pirata One',
      variant((d) => {
        applyTheme(d, 'riveted');
        d.base.presetId = 'r60';
        d.base.bottom = [60, 60];
        d.base.top = [56.6, 56.6];
        d.text.fontId = 'pirataone';
        d.text.uppercase = false;
        d.text.line1 = 'Brother Kai';
        d.plate.height = 4.2;
      }),
    ],
    [
      'MDF edge 25 mm Orbitron',
      variant((d) => {
        d.base.presetId = 'r25';
        d.base.bottom = [25, 25];
        d.base.top = [21.6, 21.6];
        d.base.edge = 'vertical';
        d.text.fontId = 'orbitron';
        d.text.line1 = 'MAGOS T-14';
        d.plate.height = 2.6;
      }),
    ],
    [
      'blackletter, fixed width, rotated',
      variant((d) => {
        d.text.fontId = 'unifrakturcook';
        d.text.uppercase = false;
        d.text.line1 = 'Castellan Rho';
        d.plate.width = { mode: 'mm', value: 30 };
        d.plate.angleDeg = 45;
      }),
    ],
    [
      'empty text',
      variant((d) => {
        d.text.line1 = '';
      }),
    ],
  ];

  it.each(cases)('%s -> single watertight solid', async (_name, design) => {
    const res = await buildPlate(wasm, fonts, design);
    expect(res.stats.status).toBe('NoError');
    expect(res.stats.watertight).toBe(true);
    expect(res.stats.components).toBe(1);
    expect(res.stats.volume).toBeGreaterThan(0);
    expect(res.mesh.indices.length).toBe(res.stats.triangles * 3);
  });

  it('places the back face on the rim, offset by the gap', async () => {
    const res = await buildPlate(wasm, fonts, DEFAULT_DESIGN);
    const map = createRimMap(resolveFrustum(DEFAULT_DESIGN.base), DEFAULT_DESIGN.plate.angleDeg);
    const { positions } = res.mesh;
    let minW = Infinity;
    let maxW = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      const [, , w] = map.toFlat([positions[i], positions[i + 1], positions[i + 2]]);
      minW = Math.min(minW, w);
      maxW = Math.max(maxW, w);
    }
    const { gap, thickness } = DEFAULT_DESIGN.plate;
    expect(minW).toBeCloseTo(gap, 3);
    expect(maxW).toBeCloseTo(gap + thickness + DEFAULT_DESIGN.text.depth, 2);
  });

  it('sits at the front of the base (−Y) by default', async () => {
    const res = await buildPlate(wasm, fonts, DEFAULT_DESIGN);
    const { min, max } = res.stats.bbox;
    expect((min[0] + max[0]) / 2).toBeCloseTo(0, 1);
    expect(max[1]).toBeLessThan(0);
    expect(min[2]).toBeGreaterThanOrEqual(-0.01);
    expect(max[2]).toBeLessThan(DEFAULT_DESIGN.base.height + 0.5);
  });

  it('reports build time and plate size', async () => {
    const res = await buildPlate(wasm, fonts, DEFAULT_DESIGN);
    expect(res.stats.plate.height).toBeCloseTo(DEFAULT_DESIGN.plate.height, 6);
    expect(res.stats.plate.width).toBeGreaterThan(res.fit.textWidth);
    console.log(
      `default build: ${res.stats.buildMs.toFixed(0)} ms, ${res.stats.triangles} tris, ` +
        `plate ${res.stats.plate.width.toFixed(1)} mm (${res.stats.plate.degrees.toFixed(0)}°), ` +
        `fit ${res.fit.chars}/${res.fit.capacity}`,
    );
  });
});
