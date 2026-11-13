import { FONTS } from '../data/fonts';

/**
 * Register @font-face rules for the self-hosted UI fonts and the plate-font previews.
 * Done at runtime so the URLs honour Vite's base path (GitHub Pages sub-directory).
 */
export function registerFontFaces(): void {
  const base = import.meta.env.BASE_URL;
  const rules = [
    `@font-face{font-family:'Inter';src:url('${base}fonts/Inter.ttf') format('truetype');font-weight:100 900;font-display:swap}`,
    `@font-face{font-family:'Cinzel';src:url('${base}fonts/Cinzel.ttf') format('truetype');font-weight:400 900;font-display:swap}`,
    ...FONTS.map(
      (f) =>
        `@font-face{font-family:'${f.cssFamily}';src:url('${base}fonts/${f.file}') format('truetype');` +
        `font-weight:${f.variation ? '100 900' : f.cssWeight};font-display:swap}`,
    ),
  ];
  const style = document.createElement('style');
  style.dataset.fonts = 'nameplate-forge';
  style.textContent = rules.join('\n');
  document.head.appendChild(style);
}
