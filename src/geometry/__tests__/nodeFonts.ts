import fs from 'node:fs';
import path from 'node:path';
import { FONTS } from '../../data/fonts';
import type { FontProvider } from '../build';
import { parseFont, type LoadedFont } from '../text';

/** Font provider for tests: reads the bundled fonts from public/fonts. */
export function nodeFontProvider(): FontProvider {
  const cache = new Map<string, LoadedFont>();
  return {
    async get(id) {
      const hit = cache.get(id);
      if (hit) return hit;
      const entry = FONTS.find((f) => f.id === id);
      if (!entry) throw new Error(`unknown font ${id}`);
      const buf = fs.readFileSync(path.resolve('public/fonts', entry.file));
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      const lf = parseFont(id, ab, entry.variation);
      cache.set(id, lf);
      return lf;
    },
  };
}
