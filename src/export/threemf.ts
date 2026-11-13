/**
 * 3MF writer (plan.md §5.9): one <object> per part (e.g. plate + text) and a <build> item for each,
 * so slicers (Bambu/Orca/Prusa) load them as separate objects and filaments can be assigned.
 */
import { zipSync, strToU8 } from 'fflate';

export interface MeshPart {
  name: string;
  positions: Float32Array;
  indices: Uint32Array;
  /** sRGB colour for the base material, e.g. '#C9993F' */
  color?: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const num = (n: number) => {
  const r = Math.round(n * 1e5) / 1e5;
  return Object.is(r, -0) ? '0' : String(r);
};

export function write3mf(parts: MeshPart[], title = 'Nameplate'): Uint8Array {
  const objects: string[] = [];
  const items: string[] = [];
  const colors = parts.map((p) => (p.color ?? '#B0B0B0').toUpperCase());
  const materials =
    `<basematerials id="1">` +
    parts.map((p, i) => `<base name="${esc(p.name)}" displaycolor="${colors[i]}FF"/>`).join('') +
    `</basematerials>`;
  parts.forEach((p, i) => {
    const id = i + 2;
    const verts: string[] = [];
    for (let k = 0; k < p.positions.length; k += 3) {
      verts.push(
        `<vertex x="${num(p.positions[k])}" y="${num(p.positions[k + 1])}" z="${num(p.positions[k + 2])}"/>`,
      );
    }
    const tris: string[] = [];
    for (let k = 0; k < p.indices.length; k += 3) {
      tris.push(
        `<triangle v1="${p.indices[k]}" v2="${p.indices[k + 1]}" v3="${p.indices[k + 2]}"/>`,
      );
    }
    objects.push(
      `<object id="${id}" name="${esc(p.name)}" type="model" pid="1" pindex="${i}">` +
        `<mesh><vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh></object>`,
    );
    items.push(`<item objectid="${id}"/>`);
  });

  const model =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">` +
    `<metadata name="Title">${esc(title)}</metadata>` +
    `<metadata name="Application">Nameplate Forge</metadata>` +
    `<resources>${materials}${objects.join('')}</resources>` +
    `<build>${items.join('')}</build></model>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>` +
    `</Types>`;
  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>` +
    `</Relationships>`;

  return zipSync(
    {
      '[Content_Types].xml': strToU8(contentTypes),
      '_rels/.rels': strToU8(rels),
      '3D/3dmodel.model': strToU8(model),
    },
    { level: 6 },
  );
}
