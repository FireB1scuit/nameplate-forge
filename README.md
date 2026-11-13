# Nameplate Forge

A free, browser-only tool for making 3D-printable nameplates that fit the rim of miniature wargaming bases. Enter the base size, text, font and style, check it in a live 3D view on the actual base, and download an STL. You don't need to install Blender or anything else.

**Status:** milestones M0–M5 built. Not deployed yet. Base dimensions are still estimates until real bases are measured: please [send measurements](.github/ISSUE_TEMPLATE/base-measurement.yml). See [plan.md](plan.md) for the spec, roadmap and implementation notes.

## Features
- Round, oval, square and rectangular bases (sloped plastic or flat MDF edges), presets or custom sizes
- Plates that wrap the sloped rim exactly (ovals: close approximation; squares: one flat side)
- Nine plate styles (Plain, Riveted Iron, Gothic, Scroll Banner, Monument, Wooden Plank, Scrap Metal, Xenos Sleek, Forge Cog), every layer editable: outline, border, end-caps (or your own SVG), surface texture
- Eight bundled open-licence fonts, or upload your own (stays on your device)
- Raised, engraved or cut-through text; a second line for rank; thicken strokes; alignment
- Blend-into-rim, top lip that hooks over the edge, fire-arc notches
- Live 3D view: camera presets, painted preview, 28 mm figure for scale, ruler, PNG screenshot
- Print check: watertight, thin strokes for your printer (resin/FDM), readability, with one-click fixes
- Export STL or 3MF (plate and text as separate parts), in place or flat for printing, with or without the base
- Squad batch: paste names → per-plate fit check → ZIP of STL/3MF files
- Share links, undo/redo, saved styles, works offline once loaded

## Development
```sh
npm ci
npm run dev       # http://localhost:5173/nameplate-forge/
npm test          # unit + geometry tests (real manifold wasm + fonts in Node)
npm run lint
npm run build && npm run preview
npm run e2e       # Playwright smoke test (uses your installed Chrome; needs a build)
```
Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml` once Pages is enabled with "GitHub Actions" as the source.

Fonts are bundled from Google Fonts under the SIL Open Font License 1.1; each `public/fonts/*.ttf` ships with its `*-OFL.txt`. Geometry is built with [manifold-3d](https://github.com/elalish/manifold) (Apache-2.0).

- UI design mockups: https://claude.ai/artifact/6vnLvffFBKNFAVFZNAZq6G (private; ask the owner for access)
- Planned live site: https://fireb1scuit.github.io/nameplate-forge/

## Disclaimer
Nameplate Forge is an unofficial fan tool. It is not affiliated with or endorsed by Games Workshop. All trademarks belong to their respective owners.
