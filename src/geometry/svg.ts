/**
 * Minimal SVG → polygons converter for end-cap artwork (plan.md §3.4 layer 3).
 *
 * Runs in the worker (no DOM), so it parses with regular expressions. Supported: <path> (all
 * commands M L H V C S Q T A Z, absolute and relative), <polygon>, <polyline>, <rect>, <circle>,
 * <ellipse>, the root viewBox, and fill-rule. Transforms, strokes, <use> and CSS are ignored and
 * reported as warnings so uploads fail loudly rather than silently.
 *
 * Output coordinates are y-up (SVG is y-down), in SVG user units.
 */
import type { Vec2 } from './conemap';

export interface SvgShape {
  contours: Vec2[][];
  fillRule: 'NonZero' | 'EvenOdd';
}

export interface ParsedSvg {
  shapes: SvgShape[];
  /** viewBox or computed bounds [minX, minY, width, height] in SVG coords */
  viewBox: [number, number, number, number] | null;
  warnings: string[];
}

const NUM = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return m ? (m[2] ?? m[3] ?? null) : null;
}
function attrNum(tag: string, name: string, fallback = 0): number {
  const v = attr(tag, name);
  const n = v == null ? NaN : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}
function fillRuleOf(tag: string): 'NonZero' | 'EvenOdd' {
  const direct = attr(tag, 'fill-rule');
  const style = attr(tag, 'style') ?? '';
  const fromStyle = /fill-rule\s*:\s*(evenodd|nonzero)/i.exec(style)?.[1];
  return (direct ?? fromStyle ?? '').toLowerCase() === 'evenodd' ? 'EvenOdd' : 'NonZero';
}

/** Flatten a path `d` string to polygons (y-down SVG coords). `tol` is the chord tolerance. */
export function pathToPolygons(d: string, tol = 0.2): Vec2[][] {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const out: Vec2[][] = [];
  let cur: Vec2[] = [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let lastCtrl: Vec2 | null = null;
  let lastQuad: Vec2 | null = null;
  const isCmd = (t: string | undefined) => t !== undefined && /^[a-zA-Z]$/.test(t);
  const next = () => parseFloat(tokens[i++]);
  const flush = () => {
    if (cur.length >= 3) out.push(cur);
    cur = [];
  };
  const seg = (n: number) => Math.min(64, Math.max(2, Math.ceil(n)));

  const cubic = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    const dd = Math.max(
      Math.hypot(x - 2 * x1 + x2, y - 2 * y1 + y2),
      Math.hypot(x1 - 2 * x2 + x3, y1 - 2 * y2 + y3),
    );
    const n = seg(Math.sqrt((3 * dd) / (4 * tol)));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const mt = 1 - t;
      cur.push([
        mt * mt * mt * x + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3,
        mt * mt * mt * y + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3,
      ]);
    }
    lastCtrl = [x2, y2];
    x = x3;
    y = y3;
  };
  const quad = (x1: number, y1: number, x2: number, y2: number) => {
    const dd = Math.hypot(x - 2 * x1 + x2, y - 2 * y1 + y2);
    const n = seg(Math.sqrt(dd / (4 * tol)));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const mt = 1 - t;
      cur.push([
        mt * mt * x + 2 * mt * t * x1 + t * t * x2,
        mt * mt * y + 2 * mt * t * y1 + t * t * y2,
      ]);
    }
    lastQuad = [x1, y1];
    x = x2;
    y = y2;
  };
  const arc = (
    rx: number,
    ry: number,
    phiDeg: number,
    large: number,
    sweep: number,
    x2: number,
    y2: number,
  ) => {
    // endpoint -> centre parameterisation (SVG spec F.6.5)
    if (rx === 0 || ry === 0) {
      cur.push([x2, y2]);
      x = x2;
      y = y2;
      return;
    }
    rx = Math.abs(rx);
    ry = Math.abs(ry);
    const phi = (phiDeg * Math.PI) / 180;
    const cp = Math.cos(phi);
    const sp = Math.sin(phi);
    const dx = (x - x2) / 2;
    const dy = (y - y2) / 2;
    const x1p = cp * dx + sp * dy;
    const y1p = -sp * dx + cp * dy;
    const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lam > 1) {
      rx *= Math.sqrt(lam);
      ry *= Math.sqrt(lam);
    }
    const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    let co = Math.sqrt(Math.max(0, num / den));
    if (large === sweep) co = -co;
    const cxp = (co * rx * y1p) / ry;
    const cyp = (-co * ry * x1p) / rx;
    const cx = cp * cxp - sp * cyp + (x + x2) / 2;
    const cy = sp * cxp + cp * cyp + (y + y2) / 2;
    const ang = (ux: number, uy: number, vx: number, vy: number) =>
      Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!sweep && dt > 0) dt -= 2 * Math.PI;
    if (sweep && dt < 0) dt += 2 * Math.PI;
    const n = seg(
      (Math.abs(dt) * Math.max(rx, ry)) / Math.max(0.05, Math.sqrt(8 * tol * Math.max(rx, ry))),
    );
    for (let k = 1; k <= n; k++) {
      const t = t1 + (dt * k) / n;
      cur.push([
        cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp,
        cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp,
      ]);
    }
    x = x2;
    y = y2;
  };

  while (i < tokens.length) {
    if (isCmd(tokens[i])) cmd = tokens[i++];
    else if (!cmd) {
      i++;
      continue;
    }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    // drawing after Z without M continues from the subpath start
    if (C !== 'M' && C !== 'Z' && cur.length === 0) cur.push([x, y]);
    if (C !== 'C' && C !== 'S') lastCtrl = null;
    if (C !== 'Q' && C !== 'T') lastQuad = null;
    switch (C) {
      case 'M': {
        flush();
        x = ox + next();
        y = oy + next();
        sx = x;
        sy = y;
        cur.push([x, y]);
        cmd = rel ? 'l' : 'L'; // subsequent pairs are line-tos
        break;
      }
      case 'L':
        x = ox + next();
        y = oy + next();
        cur.push([x, y]);
        break;
      case 'H':
        x = (rel ? x : 0) + next();
        cur.push([x, y]);
        break;
      case 'V':
        y = (rel ? y : 0) + next();
        cur.push([x, y]);
        break;
      case 'C': {
        const a = [next(), next(), next(), next(), next(), next()];
        cubic(ox + a[0], oy + a[1], ox + a[2], oy + a[3], ox + a[4], oy + a[5]);
        break;
      }
      case 'S': {
        const a = [next(), next(), next(), next()];
        const lc = lastCtrl as Vec2 | null;
        const c1: Vec2 = lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y];
        cubic(c1[0], c1[1], ox + a[0], oy + a[1], ox + a[2], oy + a[3]);
        break;
      }
      case 'Q': {
        const a = [next(), next(), next(), next()];
        quad(ox + a[0], oy + a[1], ox + a[2], oy + a[3]);
        break;
      }
      case 'T': {
        const a = [next(), next()];
        const lq = lastQuad as Vec2 | null;
        const c1: Vec2 = lq ? [2 * x - lq[0], 2 * y - lq[1]] : [x, y];
        quad(c1[0], c1[1], ox + a[0], oy + a[1]);
        break;
      }
      case 'A': {
        const a = [next(), next(), next(), next(), next(), next(), next()];
        arc(a[0], a[1], a[2], a[3], a[4], ox + a[5], oy + a[6]);
        break;
      }
      case 'Z':
        x = sx;
        y = sy;
        flush();
        // stray numbers after Z are invalid; skip them instead of looping
        while (tokens[i] !== undefined && !isCmd(tokens[i])) i++;
        break;
      default:
        i++;
    }
  }
  flush();
  // drop duplicate closing points
  return out.map((p) => {
    const a = p[0];
    const b = p[p.length - 1];
    return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9 ? p.slice(0, -1) : p;
  });
}

function ellipsePoly(cx: number, cy: number, rx: number, ry: number): Vec2[] {
  const n = Math.max(24, Math.min(96, Math.ceil(Math.max(rx, ry) * 2)));
  return Array.from({ length: n }, (_, k): Vec2 => {
    const a = (2 * Math.PI * k) / n;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
}

export function parseSvg(text: string): ParsedSvg {
  const warnings: string[] = [];
  const shapes: SvgShape[] = [];
  const src = text.replace(/<!--[\s\S]*?-->/g, '').replace(/<defs[\s\S]*?<\/defs>/gi, '');
  const svgTag = /<svg\b[^>]*>/i.exec(src)?.[0] ?? '';
  let viewBox: ParsedSvg['viewBox'] = null;
  const vb = attr(svgTag, 'viewBox');
  if (vb) {
    const n = (vb.match(NUM) ?? []).map(Number);
    if (n.length === 4 && n[2] > 0 && n[3] > 0) viewBox = [n[0], n[1], n[2], n[3]];
  }
  if (/\btransform\s*=/.test(src)) warnings.push('SVG transforms are ignored');
  if (/<(use|image|text)\b/i.test(src)) warnings.push('<use>, <image> and <text> are ignored');

  const tags = src.match(/<(path|polygon|polyline|rect|circle|ellipse)\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const name = /<(\w+)/.exec(tag)![1].toLowerCase();
    if (attr(tag, 'fill') === 'none') continue;
    const rule = fillRuleOf(tag);
    let contours: Vec2[][] = [];
    if (name === 'path') {
      contours = pathToPolygons(attr(tag, 'd') ?? '');
    } else if (name === 'polygon' || name === 'polyline') {
      const n = (attr(tag, 'points')?.match(NUM) ?? []).map(Number);
      const pts: Vec2[] = [];
      for (let k = 0; k + 1 < n.length; k += 2) pts.push([n[k], n[k + 1]]);
      if (pts.length >= 3) contours = [pts];
    } else if (name === 'rect') {
      const x = attrNum(tag, 'x');
      const y = attrNum(tag, 'y');
      const w = attrNum(tag, 'width');
      const h = attrNum(tag, 'height');
      if (w > 0 && h > 0)
        contours = [
          [
            [x, y],
            [x + w, y],
            [x + w, y + h],
            [x, y + h],
          ],
        ];
    } else if (name === 'circle') {
      const r = attrNum(tag, 'r');
      if (r > 0) contours = [ellipsePoly(attrNum(tag, 'cx'), attrNum(tag, 'cy'), r, r)];
    } else if (name === 'ellipse') {
      const rx = attrNum(tag, 'rx');
      const ry = attrNum(tag, 'ry');
      if (rx > 0 && ry > 0)
        contours = [ellipsePoly(attrNum(tag, 'cx'), attrNum(tag, 'cy'), rx, ry)];
    }
    if (contours.length) {
      // flip to y-up
      shapes.push({
        contours: contours.map((c) => c.map(([px, py]): Vec2 => [px, -py])),
        fillRule: rule,
      });
    }
  }
  if (!shapes.length) warnings.push('No filled shapes found in the SVG');
  return { shapes, viewBox, warnings };
}
