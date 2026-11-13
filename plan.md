# Nameplate Forge: Project Plan

> App name: **Nameplate Forge** · repo: `nameplate-forge` · Pages URL: `https://<user>.github.io/nameplate-forge/`. A free, browser-only tool for making 3D-printable nameplates that fit the rim of wargaming miniature bases. Hosted on GitHub Pages. No installs, no Blender, no server.

UI design (canvas with 4 artboards): https://claude.ai/artifact/6vnLvffFBKNFAVFZNAZq6G

---

## 1. Why this exists

Today a hobbyist who wants a name on a base can:

| Option | Problem |
|---|---|
| Paid Blender "Name Plate Builder" kits (MyMiniFactory, ~$4.99 each) | Requires Blender plus a picture guide. You pick from hundreds of template files and place the text by hand |
| Pre-made STL packs (e.g. Cults3D "Roman style") | The text is fixed and can't be changed |
| Print-to-order shops (Versatile Terrain, BattleBuilder) | Costs money per plate (about £5–8.50). Uppercase only, max 50 characters. Adds up fast for a 30-model army |
| Generic OpenSCAD customizers (Printables/MakerWorld) | Flat desk plates. Nothing that wraps a sloped base rim |
| Painting freehand / paper labels | Hard to do well, and small names are hard to read |

**The gap:** a free, live 3D, browser-based generator that fits the rim exactly (sloped plastic, flat MDF, or custom), offers themed styles, exports STL/3MF, and can do a whole squad at once.

### Ideas borrowed from existing products
- **Versatile Terrain:** styles named Riveted, Blend-into-rim, Slim/tall, Recessed, Monument and Plain. Round, oval and square bases. Fire-arc notches (90°/180°). Plates shipped **on a sprue** so you can paint first. Gothic, futuristic and Ork-style fonts.
- **MMF Blender kits:** faction themes. Plates **pre-shaped to the angle of the base edge**. Support for both sloped plastic and flat MDF edges.
- **BattleBuilder:** a browser builder with decorative icons.
- **PrintPal name plate generator:** a left panel of controls with mm values, style presets, a tolerance field, model info (triangle count and size), and multi-colour export as one STL or as a recessed plate plus text insert in a ZIP.

---

## 2. Goals and non-goals

### Goals
1. Anyone can make a printable nameplate in under 60 seconds, on desktop or phone.
2. The **3D viewer is the centrepiece**: the plate is always shown on the actual base, from any angle.
3. Output is **watertight, printable geometry** that fits the rim without manual work.
4. Fully static. Runs offline once loaded. Deployed on GitHub Pages.
5. Extensible: new themes, end-caps and base presets are data, not code.

### Non-goals (for now)
- Sculpting or freeform editing.
- Full base generators (textured base tops, scenic bits).
- Accounts or cloud storage. Sharing happens through the URL.
- Shipping any Games Workshop trademarks, logos or fonts.

---

## 3. Feature spec

Priority: **P0** = MVP, **P1** = v1.x, **P2** = later.

### 3.1 Base
| Feature | Pri | Notes |
|---|---|---|
| Round presets: 25, 28.5, 32, 40, 50, 60, 80, 90, 100, 130, 160 mm | P0 | See §6 for dimensions (to be measured) |
| Custom round: bottom Ø, top Ø, height | P0 | Covers resin/aftermarket bases |
| Edge type: **sloped plastic** / **flat MDF (vertical)** | P0 | MDF = a cylinder, which is a special case of the cone |
| Oval presets: 60×35, 75×42, 90×52, 105×70, 120×92, 150×95, 170×105 | P1 | Approximate mapping, see §5.4 |
| Square/rectangular: 20, 25, 25×50, 50×100 | P1 | Plate goes on one flat side, so no bending |
| Base shown hollow underneath (like real GW bases) in the viewer | P2 | Cosmetic |

### 3.2 Text
| Feature | Pri | Notes |
|---|---|---|
| Line 1 (name) | P0 | Live update |
| Line 2 (rank/title), its own size | P1 | Auto-stacks, and grows plate height |
| Font picker with ~8 bundled OFL fonts, previewed in their own typeface | P0 | List in §7 |
| Upload a .ttf/.otf font | P1 | Parsed locally and never uploaded |
| Letter height (mm), letter spacing (mm), uppercase toggle | P0 | |
| Raised / engraved / cut-through | P0 (raised), P1 (others) | |
| Text depth (mm) | P0 | |
| **Fit indicator:** "11 / 16 chars fit" plus auto-shrink option | P0 | Uses the actual measured text width, not a character count |
| Stroke thicken (offset glyph outlines) | P1 | Fixes thin serifs |
| Alignment (centre/left/right) when plate width is fixed | P1 | |

### 3.3 Plate shape and placement
| Feature | Pri | Notes |
|---|---|---|
| Width: **auto-fit** (text + padding + end-caps) or fixed (mm or degrees of rim) | P0 | |
| Plate height (up the slant), thickness, corner radius | P0 | |
| Position: angle around base (0° = front), vertical offset | P0 | |
| Fit gap / tolerance (back face offset from rim) | P0 | Default 0.05–0.1 mm |
| **Blend-into-rim** mode: plate front sits flush with the base surface | P1 | Matches Versatile Terrain's "blends with base edge" style |
| **Top lip** that hooks over the base's top edge for alignment | P1 | |
| **Fire-arc markers** (90°/180°): small ticks on the rim or notches in the plate | P2 | |
| Multiple plates per base (e.g. name front, unit back) | P2 | |

### 3.4 Style system (themes)
A theme is a preset of five layers. Each layer can be changed after picking a theme.

| Layer | Options |
|---|---|
| 1. Outline | rect, rounded, chamfer, pointed (gothic), scroll (forked tails), leaf (xenos), jagged (scrap), plank, monument (stepped) |
| 2. Border | none, single, double, beaded. Width and inset |
| 3. End-caps / icons | rivet, cross, skull, wing, cog, star, fleur, or user-uploaded SVG. Placed at the ends or beside the text |
| 4. Surface | smooth (P0), wood grain, hammered, stone, rust pitting (P2, displacement) |
| 5. Font + defaults | font, letter height, text mode |

Ship these themes: **Plain, Riveted Iron, Gothic Imperial, Scroll Banner, Monument, Wooden Plank, Greenskin Scrap, Xenos Sleek, Forge Cog** (see the Styles artboard). P0 = Plain + Riveted. P1 = the rest. Theme names stay generic, with no GW faction names.

### 3.5 Viewer
| Feature | Pri |
|---|---|
| Orbit / pan / zoom (mouse and touch) | P0 |
| Camera presets: Front, Side, Top, Iso, Fit | P0 |
| Base shown with a plastic material; plate shown metallic (brass/steel per theme) | P0 |
| Toggles: base, 28mm figure silhouette (for scale), wireframe, ruler/dimensions | P0 (base), P1 (others) |
| "Painted" preview (text a contrasting colour from the plate) | P1 |
| Print-check overlay: watertight, thinnest stroke vs printer minimum, readability, triangle count, bounding box | P0 (basic), P1 (stroke analysis) |
| PNG screenshot | P1 |
| Slow auto-rotate when idle | P2 |

### 3.6 Export
| Feature | Pri |
|---|---|
| Binary STL, plate only, in place on the base | P0 |
| Orientation: in place / **flat for printing** (back face down) | P1 |
| Plate + base as one solid | P1 |
| 3MF with plate and text as separate objects (multi-colour) | P1 |
| Two-part ZIP: plate with recess + text insert | P2 |
| **Print sprue**: several plates on one frame with thin gates | P1 |
| Printer profile: Resin (min feature 0.3 mm) / FDM (0.8 mm) drives warnings | P1 |

### 3.7 Workflow
| Feature | Pri |
|---|---|
| **Share link:** whole design stored in the URL hash | P0 |
| Undo/redo | P1 |
| Saved presets ("My Ultramarine squad style") in localStorage | P1 |
| **Batch / squad mode:** paste "Name, Rank" lines → per-plate fit check → ZIP of STLs or one sprue STL | P1 |
| Installable / offline (PWA) | P2 |

---

## 4. UX and layout

See the design canvas for all four artboards.

### Desktop (≥ 1024 px)
- **Top bar:** logo, design name, undo/redo, *Share link*, primary **Export** button.
- **Left panel (~360 px)**, numbered sections in workflow order:
  1. **Base:** shape segment (Round/Oval/Square/Custom), size chips, edge type (Sloped/MDF).
  2. **Text:** name, line 2, font (previewed in its own typeface), letter height + spacing sliders, Raised/Engraved/Cut. Fit indicator in the section header.
  3. **Style:** 3 theme thumbnails + "All themes" link to the full gallery.
  4. **Plate & placement:** Auto/Fixed width, height, thickness, position angle, fit gap.
  5. **Advanced** (collapsed): lip, fire-arc markers, surface, printer profile.
- **Viewport** (fills the rest): camera preset group (top-left), view toggles (top-right), screenshot button. A floating **print check** card bottom-right. Footer with control hints and the current base spec.

### Phone (< 768 px)
- Viewport takes the top ~40%. A bottom sheet holds the controls, with a tab bar: **Base / Text / Style / Plate**. Export is in the top bar.
- Touch targets ≥ 44 px. Sliders show a numeric value. Tapping the value opens a number input.

### Visual language
- Dark "forge" theme: ground `#0F1012`, panels `#17181C`, raised `#1F2026`, border `#2C2E36`, text `#ECEAE4`, muted `#A09FA8`, brass accent `#D4A853` (text on accent `#1A1408`), ok `#6FCF97`, warn `#E8B04A`.
- Type: **Cinzel** for the wordmark and headings only, **Inter** for all UI.
- A light theme is optional (P2). The viewer background stays dark either way.

### Interaction rules
- Every change rebuilds the geometry live (debounced ~100 ms, see §5.6). The UI never blocks.
- Bad input (text too long, stroke too thin) never prevents export. It shows a warning with a one-click fix ("auto-shrink", "thicken strokes", "widen plate").
- All values are in **mm**. Angles are in degrees.

---

## 5. Technical design

### 5.1 Stack
| Concern | Choice | Licence |
|---|---|---|
| Build | Vite + TypeScript (strict) | MIT |
| UI | React 18 | MIT |
| 3D | three.js + @react-three/fiber + @react-three/drei | MIT |
| State | zustand (+ zundo for undo/redo) | MIT |
| Fonts → outlines | opentype.js | MIT |
| 2D boolean/offset + 3D solids | **manifold-3d** (WASM): `CrossSection`, `extrude`, `refineToLength`, `warp`, booleans | Apache-2.0 |
| Background work | Web Worker + Comlink | Apache-2.0 |
| URL state compression | lz-string | MIT |
| Zip (3MF, batch) | fflate | MIT |
| Tests | Vitest (unit), Playwright (smoke) | MIT/Apache |

Use exact pinned versions in `package.json`.

### 5.2 Project layout
```
/
├─ index.html
├─ vite.config.ts            # base: '/nameplate-forge/'
├─ public/
│  ├─ fonts/*.ttf            # bundled OFL fonts + OFL.txt each
│  ├─ endcaps/*.svg          # our own end-cap/icon artwork
│  └─ figure.glb             # generic 28mm scale silhouette (own model)
├─ src/
│  ├─ main.tsx, App.tsx
│  ├─ state/
│  │  ├─ schema.ts           # Design type, defaults, version + migrations
│  │  ├─ store.ts            # zustand store (design + ui), undo
│  │  └─ url.ts              # design <-> URL hash
│  ├─ data/
│  │  ├─ bases.ts            # base presets (§6)
│  │  ├─ themes.ts           # theme presets
│  │  └─ fonts.ts            # font registry
│  ├─ geometry/
│  │  ├─ worker.ts           # Comlink-exposed build()
│  │  ├─ build.ts            # top-level pipeline
│  │  ├─ text.ts             # opentype → CrossSection, glyph-on-arc layout
│  │  ├─ outline.ts          # outline generators (rect, scroll, leaf, ...)
│  │  ├─ border.ts, endcaps.ts, surface.ts
│  │  ├─ conemap.ts          # rim mapping math (§5.3)
│  │  ├─ baseSolid.ts        # base as a lathe/oval solid
│  │  ├─ sprue.ts            # flat layout + gates
│  │  └─ checks.ts           # watertight, min stroke, readability, stats
│  ├─ export/
│  │  ├─ stl.ts, threemf.ts, zip.ts
│  ├─ viewer/
│  │  ├─ Viewport.tsx, BaseMesh.tsx, PlateMesh.tsx
│  │  ├─ Figure.tsx, CameraPresets.tsx, Ruler.tsx
│  └─ ui/
│     ├─ panel/BaseSection.tsx, TextSection.tsx, StyleSection.tsx, PlateSection.tsx, AdvancedSection.tsx
│     ├─ ThemeGallery.tsx, ExportDialog.tsx, BatchMode.tsx, PrintCheck.tsx
│     └─ components/          # Chip, Slider, Segmented, NumberField ...
└─ .github/workflows/deploy.yml
```

### 5.3 Core geometry: wrapping onto the rim

A round base's sloped rim is a **frustum** (a cone with the top cut off), and a cone is **developable**: it unrolls flat with no stretching. The app lays the plate out in that unrolled plane and maps it back.

**Inputs:** bottom radius `Rb`, top radius `Rt`, height `H`.

```
s   = sqrt((Rb - Rt)^2 + H^2)        // slant length
k   = (Rb - Rt) / s                  // = sin(half apex angle)
ρb  = Rb / k                         // unrolled radius of bottom edge
ρt  = Rt / k = ρb - s                // unrolled radius of top edge
```

The unrolled rim is an **annular sector** between radii `ρt` and `ρb`.

**Layout space (flat, mm):** origin at the sector's centre. The plate is centred on the +Y axis between `ρt` and `ρb`.
- **Plate outline:** generate it in a local "straight" frame (x = along the rim, y = up the slant), then bend it into the sector with `ρ = ρb - y` and `φ = x / ρmid`. Outlines are densely sampled polylines, so this is just per-point math in 2D.
- **Text:** lay glyphs out **along an arc** of radius `ρbaseline`. Each glyph is **rigidly rotated and translated** so it is tangent to the arc. Glyph shapes are never stretched, and the baseline becomes a horizontal circle on the base.
- **End-caps/icons:** placed rigidly, like glyphs.

**Extrude:** `CrossSection.extrude(depth)` gives a solid. `w` = offset from the rim surface (0 = touching the rim).

**Warp to the cone** (`Manifold.warp`, after `refineToLength(0.25)` so long edges bend smoothly):
```
ρ = hypot(X, Y);  φ = atan2(X, Y)          // in the flat sector
d = ρb - ρ                                 // distance up the slant from bottom
θ = φ / k                                  // angle around the base (plus placement angle)
r = Rb - d * (Rb - Rt) / s                 // radius at that height  (= ρ·k)
z = d * H / s
n = (H/s · radial,  (Rb-Rt)/s · up)        // outward surface normal
P = (r cosθ, r sinθ, z) + (gap + w) · n
```

**Special case, flat MDF edge (`Rb == Rt`):** `k → 0`. Use the cylinder map instead: θ = x / R, z = y, n = radial. Layout is a plain rectangle.

**Plate composition (all in flat 2D before extrusion where possible):**
```
plate2D   = outline  (- border groove  | + border ridge)
text2D    = glyphs (+ stroke offset) ∪ icons
raised:   solid = extrude(plate2D, T) ∪ translateZ(extrude(text2D, D), T)
engraved: solid = extrude(plate2D, T) − translateZ(extrude(text2D, D), T − D)
cut:      solid = extrude(plate2D − text2D, T)
then      solid = warp(refine(solid))
```
Doing the booleans in **2D (CrossSection)** first is much faster and more robust than 3D booleans. The only 3D boolean is the raised/engraved text layer.

### 5.4 Other base shapes
- **Square/rect:** the edge is a flat slanted plane, so plate it on one face. The map is a rotation plus a tilt with no bending. Plates can't wrap round corners (P2 option: limit width to the face).
- **Oval (approximate):** the rim is a frustum of an elliptic cone, which can't be unrolled exactly. Parameterise the mid-height ellipse by **arc length** (precompute a lookup table from arc length to ellipse angle). Map x → arc length, y → slant distance along the local normal plane. Distortion is tiny for plate lengths under ~1/4 of the perimeter. Show a note in the UI if the plate covers a strongly curved end.

### 5.5 Fonts and text
- opentype.js parses TTF/OTF (bundled or uploaded). Use `font.getPath`, or per-glyph `glyph.getPath`, with kerning from `font.getKerningValue`.
- Flatten curves adaptively (chord tolerance 0.01 mm at final scale). Feed contours to `new CrossSection(polys, 'NonZero')`, which handles overlapping contours and self-intersections.
- Scale: letter height = **cap height** (`font.tables.os2.sCapHeight`, falling back to units-per-em × 0.7), so "2.8 mm" means what users expect.
- Stroke thicken: `cs.offset(delta, 'Round')`.
- **Min stroke estimate:** erode by `min/2` (`offset(-min/2)`). If area is lost on any glyph, it has features thinner than `min`. Flag those glyphs.
- **Fit:** measured advance width + padding + end-caps vs the plate's max width (default max = 90° of the rim, user-adjustable).

### 5.6 Worker pipeline
```
UI (zustand design) --debounce 100ms--> worker.build({id, design})
worker: load manifold wasm once → build → checks → mesh arrays
worker --transfer--> {id, parts:[{name, positions:Float32Array, indices:Uint32Array}], stats, warnings}
UI: ignore results with id < latest; swap BufferGeometry in PlateMesh
```
- Export calls `worker.export({design, format, options})` and returns an `ArrayBuffer` (STL/3MF/ZIP), so the main thread does no heavy work.
- Batch: `worker.exportBatch(designs[])`. Report progress with Comlink callbacks.
- Performance target: < 150 ms rebuild for a typical plate (≈ 15 glyphs) on a mid-range laptop.

### 5.7 Data model (sketch)
```ts
type Design = {
  v: 1;
  base: { shape: 'round'|'oval'|'square'|'rect'; presetId?: string;
          bottom: [number, number]; top: [number, number]; height: number; edge: 'sloped'|'vertical' };
  text: { line1: string; line2?: string; fontId: string; size1: number; size2?: number;
          spacing: number; uppercase: boolean; mode: 'raised'|'engraved'|'cut'; depth: number; thicken: number;
          align: 'center'|'left'|'right' };
  plate: { width: { mode: 'auto'|'mm'|'deg'; value: number }; height: number; thickness: number;
           padding: number; cornerRadius: number; angleDeg: number; offsetY: number; gap: number;
           blend: boolean; lip?: { depth: number; thickness: number } };
  style: { themeId: string; outline: OutlineSpec; border: BorderSpec; endCaps: EndCapSpec; surface: SurfaceSpec };
  extras?: { fireArc?: 90 | 180 };
};
type UIState = { camera: 'front'|'side'|'top'|'iso'; showBase: boolean; showFigure: boolean;
                 wireframe: boolean; painted: boolean; printer: 'resin'|'fdm' };
```
- **URL:** `#d=` + `lz-string.compressToEncodedURIComponent(JSON.stringify(diff(design, defaults)))`. Only non-default fields are stored, so links stay short. Uploaded fonts/SVGs **can't** go in the URL: show "uses a custom font" and fall back to the default.
- **Schema versioning:** `v` field plus a `migrations[v]` chain.

### 5.8 Viewer details
- `<Canvas>` with `OrbitControls` (damping, min/max distance scaled to base size). Use `Bounds` for "Fit".
- Lighting: hemisphere light + 2 directional lights. `ContactShadows` under the base. **Don't** rely on drei `Environment` presets that fetch from a CDN. Use `Lightformer`s, or bundle a small HDR.
- Base mesh: `LatheGeometry` from the frustum profile (oval: scaled lathe). Plastic material.
- Plate mesh: `MeshStandardMaterial` per theme (metalness/roughness/colour). Text part is a separate material in painted mode.
- Figure: a small generic GLB we model ourselves (capsule-style trooper silhouette, ~28 mm "heroic" scale).
- Ruler: an arc dimension along the plate + height callout, drawn with drei `Line` + `Html` labels.

### 5.9 Export formats
- **STL:** binary, written straight from the manifold mesh (normals computed per triangle). Units are mm.
- **3MF:** `3D/3dmodel.model` XML with one `<object>` per part (plate, text) + `<build>` items, `[Content_Types].xml`, `_rels/.rels`, zipped with fflate. Slicers (Bambu/Orca/Prusa) see the parts as separate objects, so you can assign filaments.
- **Flat-for-print orientation:** apply the inverse map, i.e. export the **pre-warp** flat solid. It's printable flat but won't match the rim curvature. Instead, rotate the warped solid so its back face sits on the bed. Rotate so the plate's central back normal points −Z, then drop to Z=0.
- **Sprue:** grid-layout N flat-oriented plates. Add a rectangular frame (1.2 × 1.2 mm bars) and gates (0.5 mm Ø stubs) at plate ends. Union everything into one solid.

### 5.10 Deployment
- `vite.config.ts`: `base: '/<repo>/'`. Configure the worker as an ES module. Import the manifold wasm via `?url` and pass it to `locateFile`.
- `.github/workflows/deploy.yml`: on push to `main` → `npm ci` → `npm run test` → `npm run build` → `actions/upload-pages-artifact` → `actions/deploy-pages`.
- GitHub Pages serves `.wasm` with the correct MIME type. No COOP/COEP is needed (manifold's single-threaded build doesn't need SharedArrayBuffer).

---

## 6. Base presets

> ⚠️ Top diameter and height **must be measured** with calipers on real GW bases before release. Until then, use a placeholder rule: `top = bottom − 3.4 mm`, `height = 4.0 mm` (≤ 60 mm) / `5.0 mm` (> 60 mm). Add a GitHub issue template "Base measurement correction".

| id | Shape | Bottom (mm) | Top (mm) | Height (mm) |
|---|---|---|---|---|
| r25 | round | 25 | TBD | TBD |
| r28 | round | 28.5 | TBD | TBD |
| r32 | round | 32 | TBD | TBD |
| r40 | round | 40 | TBD | TBD |
| r50 | round | 50 | TBD | TBD |
| r60 | round | 60 | TBD | TBD |
| r80 | round | 80 | TBD | TBD |
| r90 | round | 90 | TBD | TBD |
| r100 | round | 100 | TBD | TBD |
| r130 | round | 130 | TBD | TBD |
| r160 | round | 160 | TBD | TBD |
| o60x35 … o170x105 | oval | 60×35, 75×42, 90×52, 105×70, 120×92, 150×95, 170×105 | TBD | TBD |
| s20, s25 | square | 20, 25 | TBD | TBD |
| q25x50, q50x100 | rect | 25×50, 50×100 | TBD | TBD |
| mdf-* | any | user | = bottom | user (typically 3 mm) |

---

## 7. Assets and licensing
- **Fonts (bundled, SIL OFL):** Cinzel, UnifrakturCook, Pirata One, IM Fell English SC, New Rocker, Metamorphous, Orbitron, Inter (UI). Ship the `OFL.txt` with each. Show the licences in an "About" dialog.
- **End-caps/icons:** our own SVG artwork only. No aquila, no faction symbols, no GW IP. Users can upload their own SVGs, which stay local.
- **App name/branding:** don't use "Warhammer" in the app name. In the README, say "compatible with Games Workshop® bases" as nominative use, with a trademark disclaimer.
- **App licence:** MIT (suggested). manifold-3d is Apache-2.0, so include its NOTICE.

---

## 8. Milestones and task checklist

### M0: Skeleton (≈ 1–2 days)
- [ ] `npm create vite` (React + TS). ESLint + Prettier. Pin versions
- [ ] GitHub repo + Pages deploy workflow. Hello-world live
- [ ] Worker + Comlink + manifold-3d wasm loading in the worker (dev + prod build)
- [ ] r3f canvas with OrbitControls, lights, contact shadow, lathe base mesh

### M1: MVP: round base, plain plate, STL (≈ 1 week)
- [ ] `schema.ts` defaults + zustand store
- [ ] `conemap.ts` with unit tests (round-trip, cylinder special case, known points)
- [ ] `text.ts`: opentype load, glyph-on-arc layout, CrossSection union, cap-height scaling
- [ ] `outline.ts`: rect + rounded
- [ ] `build.ts`: raised text pipeline → warp → mesh arrays
- [ ] Panel sections: Base (round presets + custom + edge type), Text (line 1, font, height, spacing, raised), Plate (auto/fixed width, height, thickness, angle, gap)
- [ ] Live rebuild with debounce + stale-result guard
- [ ] Fit indicator + auto-shrink
- [ ] Camera presets
- [ ] STL export (in place)
- [ ] Share link (URL hash)
- [ ] Print check: watertight + stats + readability warning
- [ ] Responsive layout: phone bottom sheet

### M2: Styles (≈ 1–2 weeks)
- [ ] Theme data model + gallery dialog
- [ ] Outlines: chamfer, pointed, scroll, leaf, jagged, plank, monument
- [ ] Border: single, double, beaded
- [ ] End-caps from bundled SVGs (SVG path → polygons) + custom SVG upload
- [ ] Engraved + cut-through modes
- [ ] Line 2 (rank)
- [ ] Custom font upload
- [ ] Per-theme viewer materials + painted preview
- [ ] Min-stroke analysis + "thicken" fix

### M3: Fit and more bases (≈ 1 week)
- [ ] Measure and fill in base table (§6)
- [ ] Oval mapping (arc-length LUT)
- [ ] Square/rect face mapping
- [ ] Blend-into-rim mode, top lip
- [ ] Plate + base export
- [ ] Ruler / dimension overlay, figure silhouette GLB

### M4: Power features (≈ 1 week)
- [ ] Batch mode: paste list → table with per-row fit → ZIP / sprue
- [ ] Flat-for-print orientation, sprue generator
- [ ] 3MF multi-part export
- [ ] Undo/redo, saved presets
- [ ] Printer profiles (resin/FDM) drive defaults + warnings

### M5: Polish (ongoing)
- [ ] Fire-arc markers
- [ ] Surface textures (displacement)
- [ ] PWA/offline
- [ ] Screenshot PNG, auto-rotate
- [ ] Accessibility pass (keyboard on all controls, labels, contrast)
- [ ] Docs page: "how to print and attach" (resin/FDM settings, glue tips, paint-on-sprue)

---

## 9. Testing
- **Unit (Vitest):** conemap maths, outline generators (closed, non-self-intersecting), text layout widths, URL encode/decode round-trip, schema migrations.
- **Geometry invariants** (run in Node with manifold-3d): for a matrix of bases × themes × modes, check `status === NoError`, genus sanity, volume > 0, bounding box within the expected rim region, and that the back face is within `gap ± 0.01 mm` of the cone surface (sample points).
- **Golden files:** keep a few reference STLs and compare volume/area within tolerance (not byte-identical).
- **Playwright smoke:** load the app, type a name, wait for a mesh, export STL, check file size > 0.
- **Real-world:** print test plates on 25/32/40/60 mm bases on resin and FDM before each milestone release.

---

## 10. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Base dimensions differ between manufacturers or batches | Custom dims + fit-gap slider + community measurement issue template |
| Thin font features don't print | Stroke analysis + thicken + printer profiles + font defaults per theme |
| manifold wasm loading quirks with Vite/Pages | Settle this in M0 before anything else |
| Oval mapping distortion | Arc-length LUT. Limit plate span on tight ends. Show a notice |
| Performance on phones | Worker + debounce + coarser refine while dragging sliders, full refine on release/export |
| IP issues | Generic names and own artwork. No GW fonts or logos. Disclaimer |
| URL too long for shared designs | Store a diff vs defaults + lz-string. Custom assets are not shareable (show a note) |

---

## 11. Open questions
1. Primary printer audience: **resin**, **FDM**, or both equally? This decides default sizes and minimums.
2. Is "plate + whole base" export in scope for v1, or glue-on plates only?
3. React (planned) vs Svelte?
4. ~~Final app name and repo name~~ **Decided:** Nameplate Forge, repo `nameplate-forge` (Vite `base: '/nameplate-forge/'`).
5. Should batch mode support a different style per row, or one style for the whole squad?

---

## 12. Research sources
- MyMiniFactory Name Plate Builders, e.g. [Battle Brother](https://www.myminifactory.com/object/3d-print-battle-brother-name-plate-builder-414095), [Imperial](https://www.myminifactory.com/object/3d-print-imperial-imperium-aquilla-name-plate-builder-532187), [Wooden Plank](https://www.myminifactory.com/object/3d-print-wooden-plank-name-plate-builder-439734)
- [Cults3D Roman Style Nameplates](https://cults3d.com/:1191702)
- Versatile Terrain: [GeekDad review](https://geekdad.com/2019/02/be-the-ace-of-base-with-versatile-terrain/), [Blood of Kittens](https://bloodofkittens.com/wargaminghub/?p=190438), [Spikey Bits fire arcs](https://spikeybits.com/make-custom-nameplates-fire-arcs-for-your-miniatures/)
- BattleBuilder: [Spikey Bits](https://spikeybits.com/nameplates-that-rock-battlebuilders-warhammer-ready-tools/), [B&C thread](https://bolterandchainsword.com/topic/384009-battlebuilder-nameplates/)
- [B&C: nameplates for your miniatures](https://bolterandchainsword.com/topic/380981-nameplates-for-your-miniatures-newbie/)
- [PrintPal Name Plate Generator](https://printpal.io/tools/name-plate-generator)
- [minibase (OpenSCAD)](https://github.colasdn.workers.dev/unjordy/minibase)
