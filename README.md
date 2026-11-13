# Nameplate Forge

A free, browser-only tool for making 3D-printable nameplates that fit the rim of miniature wargaming bases. Enter the base size, text, font and style, check it in a live 3D view on the actual base, and download an STL. You don't need to install Blender or anything else.

**Status:** MVP (milestones M0 + M1) built: round bases (sloped or MDF edge), raised text in 4 bundled fonts, Plain and Riveted styles, live 3D view, print check, STL export and share links. Not deployed yet. See [plan.md](plan.md) for the full spec, roadmap and implementation notes.

## Development
```sh
npm ci
npm run dev       # http://localhost:5173/nameplate-forge/
npm test          # unit + geometry tests (real manifold wasm + fonts in Node)
npm run lint
npm run build && npm run preview
```
Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml` once Pages is enabled with "GitHub Actions" as the source.

Fonts are bundled from Google Fonts under the SIL Open Font License 1.1; each `public/fonts/*.ttf` ships with its `*-OFL.txt`. Geometry is built with [manifold-3d](https://github.com/elalish/manifold) (Apache-2.0).

- UI design mockups: https://claude.ai/artifact/6vnLvffFBKNFAVFZNAZq6G (private; ask the owner for access)
- Planned live site: https://fireb1scuit.github.io/nameplate-forge/

## Planned features
- Round, oval, square and custom bases (sloped plastic or flat MDF edges)
- Plates that wrap the sloped rim exactly, with no distortion
- Themed plate styles (Plain, Riveted, Gothic, Scroll, Monument, Plank, Scrap, Xenos, Cog)
- Bundled open-licence fonts, or upload your own
- Live 3D viewer with camera presets and print checks
- STL / 3MF export, batch "squad" mode, print sprues, share links

## Disclaimer
Nameplate Forge is an unofficial fan tool. It is not affiliated with or endorsed by Games Workshop. All trademarks belong to their respective owners.
