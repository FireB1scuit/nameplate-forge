/**
 * Tests for milestones M2–M5: themes/outlines/borders/end-caps, text modes, line 2, stroke check,
 * oval + square maps, blend/lip/fire-arc, textures, exports (flat, 3MF, base, batch, sprue).
 */
import { unzipSync, strFromU8 } from 'fflate';
import Module from 'manifold-3d';
import type { ManifoldToplevel } from 'manifold-3d';
import { beforeAll, describe, expect, it } from 'vitest';
import { findPreset } from '../../data/bases';
import { SURFACES, THEMES } from '../../data/themes';
import { rotationToZ } from '../../export/orient';
import { readBinaryStl } from '../../export/stl';
import {
  applyTheme,
  DEFAULT_DESIGN,
  LEGACY_DEFAULTS,
  resolveBase,
  sanitizeDesign,
  type Design,
} from '../../state/schema';
import { decodeDesign } from '../../state/url';
import LZString from 'lz-string';
import { createBaseMap } from '../basemap';
import { buildPlate, planLayout, type BuildResult } from '../build';
import { exportBatch, exportDesign } from '../exporter';
import { buildSprue } from '../sprue';
import { parseSvg, pathToPolygons } from '../svg';
import { createOvalMap, createPlaneMap } from '../surfacemaps';
import { nodeFontProvider } from './nodeFonts';

let wasm: ManifoldToplevel;
const assets = nodeFontProvider();

beforeAll(async () => {
  wasm = await Module();
  wasm.setup();
});

const variant = (patch: (d: Design) => void): Design => {
  const d = structuredClone(LEGACY_DEFAULTS);
  patch(d);
  return d;
};
const usePreset = (d: Design, id: string) => {
  const p = findPreset(id)!;
  d.base.shape = p.shape;
  d.base.presetId = p.id;
  d.base.bottom = [...p.bottom];
  d.base.top = [...p.top];
  d.base.height = p.height;
};
const solid = (r: BuildResult) => {
  expect(r.stats.status).toBe('NoError');
  expect(r.stats.watertight).toBe(true);
  expect(r.stats.components).toBe(1);
};
const codes = (r: { warnings: Array<{ code: string }> }) => r.warnings.map((w) => w.code);

describe('themes', () => {
  it.each(THEMES.map((t) => t.id))('%s builds one watertight solid', async (id) => {
    const d = variant((d) => applyTheme(d, id));
    const r = await buildPlate(wasm, assets, d);
    solid(r);
    expect(codes(r)).not.toContain('icon-missing');
    expect(r.mesh.paint.length).toBeGreaterThan(0);
  });

  it('every outline × border combination builds', async () => {
    for (const outline of [
      'rect',
      'chamfer',
      'pointed',
      'scroll',
      'leaf',
      'jagged',
      'plank',
      'monument',
    ] as const) {
      for (const type of ['single', 'double', 'beaded'] as const) {
        const d = variant((d) => {
          d.style.outline = outline;
          d.style.border = { type, width: 0.3, inset: 0.35 };
          d.plate.height = 4.4;
        });
        const r = await buildPlate(wasm, assets, d, { strokeCheck: false });
        expect([outline, type, r.stats.watertight, r.stats.components]).toEqual([
          outline,
          type,
          true,
          1,
        ]);
      }
    }
  }, 60_000);

  it('auto width grows to make room for end-caps', async () => {
    const plain = planLayout(LEGACY_DEFAULTS, await assets.get('cinzel'));
    const d = variant((d) => {
      d.style.endCaps = { icon: 'skull', size: 2.6, place: 'ends' };
    });
    const withIcons = planLayout(d, await assets.get('cinzel'), await assets.icon!('skull'));
    expect(withIcons.rect.halfU).toBeGreaterThan(plain.rect.halfU + 2);
  });
});

describe('text modes', () => {
  it('engraved: watertight, recess painted, thinner than raised', async () => {
    const r = await buildPlate(
      wasm,
      assets,
      variant((d) => void (d.text.mode = 'engraved')),
    );
    solid(r);
    expect(r.mesh.paint.length).toBeGreaterThan(0);
    expect(r.stats.plate.thickness).toBeCloseTo(LEGACY_DEFAULTS.plate.thickness, 6);
  });

  it('engraved depth is limited so the plate keeps a back', async () => {
    const r = await buildPlate(
      wasm,
      assets,
      variant((d) => {
        d.text.mode = 'engraved';
        d.text.depth = 0.8;
        d.plate.thickness = 0.8;
      }),
    );
    solid(r);
    expect(codes(r)).toContain('engrave-depth');
  });

  it('cut-through drops loose letter centres and stays one part', async () => {
    const r = await buildPlate(
      wasm,
      assets,
      variant((d) => {
        d.text.mode = 'cut';
        d.text.line1 = 'BOOM';
        d.text.size1 = 3.4;
        d.plate.height = 5;
      }),
    );
    solid(r);
    expect(codes(r)).toContain('cut-islands');
  });
});

describe('line 2, align, thicken, strokes', () => {
  it('stacks two lines and grows the plate', async () => {
    const d = variant((d) => {
      d.text.line2 = 'SERGEANT';
      d.plate.height = 3.6;
    });
    const plan = planLayout(d, await assets.get('cinzel'));
    expect(plan.lines).toHaveLength(2);
    expect(plan.lines[0].vBaseline).toBeGreaterThan(plan.lines[1].vBaseline + plan.lines[1].size);
    expect(plan.rect.vTop - plan.rect.vBottom).toBeGreaterThan(3.6);
    expect(codes(plan)).toContain('plate-grown');
    solid(await buildPlate(wasm, assets, d));
  });

  it('aligns text left in a wide fixed plate', async () => {
    const d = variant((d) => {
      d.plate.width = { mode: 'mm', value: 50 };
      d.text.align = 'left';
      d.text.line1 = 'KAI';
    });
    const plan = planLayout(d, await assets.get('cinzel'));
    expect(plan.lines[0].offset).toBeLessThan(-5);
  });

  it('thicken makes the text wider in area', async () => {
    const a = await buildPlate(wasm, assets, LEGACY_DEFAULTS);
    const b = await buildPlate(
      wasm,
      assets,
      variant((d) => void (d.text.thicken = 0.1)),
    );
    solid(b);
    expect(b.stats.volume).toBeGreaterThan(a.stats.volume);
  });

  it('flags strokes thinner than the FDM minimum', async () => {
    const r = await buildPlate(wasm, assets, LEGACY_DEFAULTS, { printer: 'fdm' });
    expect(codes(r)).toContain('thin-strokes');
    const big = await buildPlate(
      wasm,
      assets,
      variant((d) => {
        d.text.size1 = 6;
        d.plate.height = 8;
        d.text.fontId = 'orbitron';
        d.text.line1 = 'KAI';
      }),
    );
    expect(codes(big)).not.toContain('thin-strokes');
  });
});

describe('oval and square maps', () => {
  const oval = {
    bottom: [60, 35] as [number, number],
    top: [56.6, 31.6] as [number, number],
    H: 4,
  };

  it('oval map round-trips and keeps arc length along the rim', () => {
    const m = createOvalMap(oval, 20);
    for (const [X, Y, w] of [
      [0, 1, 0],
      [8, 2.5, 0.3],
      [-15, 0.5, 0.1],
      [30, 3, 0],
    ]) {
      const back = m.toFlat(m.toWorld(X, Y, w));
      expect(back[0]).toBeCloseTo(X, 3);
      expect(back[1]).toBeCloseTo(Y, 3);
      expect(back[2]).toBeCloseTo(w, 4);
    }
    // 1 mm steps along the rim at the mid height are 1 mm apart in the world
    const v = m.slant / 2;
    const a = m.toWorld(10, v, 0);
    const b = m.toWorld(11, v, 0);
    expect(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])).toBeCloseTo(1, 2);
  });

  it('square map is exact and plates stay on one face', () => {
    const m = createPlaneMap({ bottom: [25, 25], top: [21.6, 21.6], H: 4 }, 90);
    const P = m.toWorld(3, 2, 0.2);
    const back = m.toFlat(P);
    expect(back[0]).toBeCloseTo(3, 9);
    expect(back[1]).toBeCloseTo(2, 9);
    expect(back[2]).toBeCloseTo(0.2, 9);
    // face 90° is the +X side
    expect(m.toWorld(0, 0, 0)[0]).toBeCloseTo(12.5, 9);
  });

  it.each(['o60x35', 'o105x70', 's25', 'q25x50'])('%s builds and sits on the rim', async (id) => {
    const d = variant((d) => {
      usePreset(d, id);
      d.text.line1 = 'KAI';
    });
    const r = await buildPlate(wasm, assets, d);
    solid(r);
    const map = createBaseMap(resolveBase(d.base), d.plate.angleDeg);
    let minW = Infinity;
    const p = r.mesh.positions;
    for (let i = 0; i < p.length; i += 3)
      minW = Math.min(minW, map.toFlat([p[i], p[i + 1], p[i + 2]])[2]);
    expect(minW).toBeCloseTo(d.plate.gap, 2);
  });

  it('trims a fixed plate that is wider than a square side', async () => {
    const d = variant((d) => {
      usePreset(d, 's25');
      d.plate.width = { mode: 'mm', value: 40 };
    });
    const plan = planLayout(d, await assets.get('cinzel'));
    expect(codes(plan)).toContain('too-wide');
    expect(plan.rect.halfU * 2).toBeLessThan(25);
  });
});

describe('placement extras', () => {
  it('blend: full-height plate with tapered edges', async () => {
    const r = await buildPlate(
      wasm,
      assets,
      variant((d) => void (d.plate.blend = true)),
    );
    solid(r);
    const map = createBaseMap(resolveBase(LEGACY_DEFAULTS.base), 0);
    expect(r.stats.plate.height).toBeCloseTo(map.slant, 6);
  });

  it('top lip hooks over the base and stays one solid', async () => {
    const r = await buildPlate(
      wasm,
      assets,
      variant((d) => void (d.plate.lip.on = true)),
    );
    solid(r);
    expect(r.stats.bbox.max[2]).toBeGreaterThan(LEGACY_DEFAULTS.base.height + 0.3);
  });

  it('lip also works on an MDF edge', async () => {
    const r = await buildPlate(
      wasm,
      assets,
      variant((d) => {
        d.base.edge = 'vertical';
        d.plate.lip.on = true;
        d.plate.height = 2.6;
      }),
    );
    solid(r);
  });

  it('fire-arc notches cut the plate; a too-small plate warns', async () => {
    const plain = await buildPlate(wasm, assets, LEGACY_DEFAULTS);
    const notched = await buildPlate(
      wasm,
      assets,
      variant((d) => void (d.extras.fireArc = 90)),
    );
    solid(notched);
    expect(notched.stats.volume).toBeLessThan(plain.stats.volume);
    const far = await buildPlate(
      wasm,
      assets,
      variant((d) => void (d.extras.fireArc = 180)),
    );
    expect(codes(far)).toContain('fire-arc-outside');
  });

  it.each(SURFACES.filter((s) => s !== 'smooth'))(
    '%s texture stays watertight',
    async (surface) => {
      const r = await buildPlate(
        wasm,
        assets,
        variant((d) => void (d.style.surface = surface)),
      );
      solid(r);
    },
  );
});

describe('exports', () => {
  it('flat STL lies on the bed', async () => {
    const r = await exportDesign(wasm, assets, LEGACY_DEFAULTS, {
      format: 'stl',
      orientation: 'flat',
      withBase: false,
      printer: 'resin',
    });
    const stl = readBinaryStl(r.data.buffer as ArrayBuffer);
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 2; i < stl.vertices.length; i += 3) {
      minZ = Math.min(minZ, stl.vertices[i]);
      maxZ = Math.max(maxZ, stl.vertices[i]);
    }
    expect(minZ).toBeCloseTo(0, 4);
    // a curved 34 mm plate on a 32 mm base stands well under its width when lying flat
    expect(maxZ).toBeLessThan(15);
  });

  it('3MF holds a plate and a text object', async () => {
    const r = await exportDesign(wasm, assets, LEGACY_DEFAULTS, {
      format: '3mf',
      orientation: 'inplace',
      withBase: true,
      printer: 'resin',
    });
    const files = unzipSync(r.data);
    expect(Object.keys(files).sort()).toEqual([
      '3D/3dmodel.model',
      '[Content_Types].xml',
      '_rels/.rels',
    ]);
    const model = strFromU8(files['3D/3dmodel.model']);
    expect(model.match(/<object /g)).toHaveLength(3);
    expect(model).toContain('name="Text"');
    expect(model).toContain('unit="millimeter"');
  });

  it('plate + base export is one solid standing on z = 0', async () => {
    const r = await buildPlate(wasm, assets, LEGACY_DEFAULTS, {
      withBase: true,
      quality: 'export',
    });
    solid(r);
    expect(r.stats.bbox.min[2]).toBeCloseTo(0, 4);
  });

  it('batch ZIP has one file per name', async () => {
    const designs = ['KAI', 'TARUS', 'VEL'].map((n) => variant((d) => void (d.text.line1 = n)));
    const r = await exportBatch(wasm, assets, designs, {
      mode: 'zip',
      format: 'stl',
      orientation: 'flat',
      printer: 'resin',
    });
    expect(Object.keys(unzipSync(r.data))).toHaveLength(3);
  });

  it('sprue joins plates, frame and gates into one solid', async () => {
    const plates = [];
    for (const n of ['KAI', 'TARUS']) {
      const r = await buildPlate(
        wasm,
        assets,
        variant((d) => void (d.text.line1 = n)),
        {
          keepManifold: true,
          strokeCheck: false,
        },
      );
      const R = rotationToZ(r.normal);
      plates.push(
        r.manifold!.transform([
          R[0][0],
          R[1][0],
          R[2][0],
          0,
          R[0][1],
          R[1][1],
          R[2][1],
          0,
          R[0][2],
          R[1][2],
          R[2][2],
          0,
          0,
          0,
          0,
          1,
        ]),
      );
      r.manifold!.delete();
    }
    const s = buildSprue(wasm, plates);
    expect(s.status()).toBe('NoError');
    const parts = s.decompose();
    expect(parts).toHaveLength(1);
    parts.forEach((p) => p.delete());
    expect(s.boundingBox().min[2]).toBeGreaterThanOrEqual(-1e-6);
    s.delete();
    plates.forEach((p) => p.delete());
  }, 30_000);
});

describe('svg + schema', () => {
  it('parses paths with relative, curve and arc commands', () => {
    const polys = pathToPolygons('M10 10 h20 v20 h-20 z m5 5 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 z');
    expect(polys).toHaveLength(2);
    expect(polys[0]).toHaveLength(4);
    const xs = polys[1].map((p) => p[0]);
    expect(Math.min(...xs)).toBeCloseTo(15, 1);
    expect(Math.max(...xs)).toBeCloseTo(25, 1);
    const svg = parseSvg(
      '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/><rect x="1" y="1" width="2" height="2" fill="none"/><path fill-rule="evenodd" d="M0 0L4 0L4 4Z"/></svg>',
    );
    expect(svg.shapes).toHaveLength(2);
    expect(svg.shapes[1].fillRule).toBe('EvenOdd');
    expect(svg.viewBox).toEqual([0, 0, 10, 10]);
  });

  it('v1 share links migrate: riveted gets its layers', () => {
    const v1 = LZString.compressToEncodedURIComponent(
      JSON.stringify({ v: 1, style: { themeId: 'riveted' } }),
    );
    const d = decodeDesign(v1)!;
    expect(d.v).toBe(3);
    expect(d.base.presetId).toBe('r32');
    expect(d.style.themeId).toBe('riveted');
    expect(d.style.border.type).toBe('single');
    expect(d.style.endCaps.icon).toBe('rivet');
  });

  it('a v2 link keeps meaning what it meant (diff against the old defaults)', () => {
    // only the line was changed in this v2 link; everything else was the old default
    const v2 = LZString.compressToEncodedURIComponent(
      JSON.stringify({ v: 2, text: { line1: 'KAI' } }),
    );
    const d = decodeDesign(v2)!;
    expect(d.text.line1).toBe('KAI');
    expect(d.base.presetId).toBe('r32');
    expect(d.style.themeId).toBe('plain');
    expect(d.plate.width.mode).toBe('auto');
  });

  it('the default design equals the shared example link', () => {
    const link =
      'N4IgRghgzgpiBcoAOAnGsAuBJAJgkKALAAwgA04A9hhpQLYIDaJZJAuhbUkwMwBsAOj5l+QtgF9OMAB4YEoADYBLAHYwAjPgDqEDAGMAFgAI9EJBgiqjEFBhh0lUciBwxzBhMQEBWTgaV6ANYwKp4C6gCckiBICrpwiCAA7ko4GB6JdJSu+HQMFABuEAoArgmE3tEGMEoA5gZy8IQCPNFQGACeCgmg6fYwuPgoSgUwdngUlCUYymr4UHoolAoKzmCUKK4o8iCdSAkgUKq13c4paRleviCqmGHq0SE4AMJmTokBlKHwIHqUtc4jgAvBLqAQRCixCB6A5gdCpOBtEooABm0IOBggeRgaDw0QKCAATOIgA';
    expect(decodeDesign(link)).toEqual(DEFAULT_DESIGN);
  });

  it('drops unknown uploaded assets from untrusted input', () => {
    const d = sanitizeDesign({
      text: { fontId: 'user:font-9' },
      style: { endCaps: { icon: 'user:icon-3' } },
    });
    expect(d.text.fontId).toBe(LEGACY_DEFAULTS.text.fontId);
    expect(d.style.endCaps.icon).toBe('none');
  });

  it('rotationToZ maps the normal onto +Z', () => {
    for (const n of [
      [0, -0.9, 0.4],
      [0.3, 0.2, 0.93],
      [0, 0, -1],
      [1, 0, 0],
    ] as Array<[number, number, number]>) {
      const R = rotationToZ(n);
      const l = Math.hypot(...n);
      const z = [0, 1, 2].map((r) => (R[r][0] * n[0] + R[r][1] * n[1] + R[r][2] * n[2]) / l);
      expect(z[0]).toBeCloseTo(0, 9);
      expect(z[1]).toBeCloseTo(0, 9);
      expect(z[2]).toBeCloseTo(1, 9);
    }
  });
});
