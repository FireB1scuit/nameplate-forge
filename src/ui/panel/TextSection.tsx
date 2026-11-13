import { useRef } from 'react';
import { FONTS, userFontList } from '../../data/fonts';
import { LIMITS, MAX_TEXT_LENGTH, type TextMode } from '../../state/schema';
import { useStore } from '../../state/store';
import { uploadFont } from '../actions';
import { Check, Chip, Section, Slider } from '../components/controls';

/** "11 / 16 chars fit" — from the measured text width reported by the worker. */
export function FitBadge({ long = false }: { long?: boolean }) {
  const fit = useStore((s) => s.build.result?.fit);
  const bottom = useStore((s) => s.design.base.bottom[0]);
  if (!fit) return <span className="note">Measuring…</span>;
  if (fit.chars === 0) {
    return <span className="note">Up to ~{fit.capacity} chars fit</span>;
  }
  const where = long ? ` on a ${bottom} mm base` : '';
  if (fit.fits && fit.shrunk) {
    return (
      <span className="note">Sized to {fit.sizeUsed.toFixed(1)} mm to fit the plate height</span>
    );
  }
  if (fit.fits) {
    return (
      <span className="note ok">
        {fit.chars} / {fit.capacity} {long ? 'characters' : 'chars'} fit{where}
      </span>
    );
  }
  if (fit.shrunk) {
    return <span className="note warn">Too long: shrunk to {fit.sizeUsed.toFixed(1)} mm</span>;
  }
  return (
    <span className="note warn">
      {fit.chars} / {fit.capacity} {long ? 'characters' : 'chars'}: too long{where}
    </span>
  );
}

const MODES: Array<[TextMode, string, string]> = [
  ['raised', 'Raised', 'Letters stand up from the plate'],
  ['engraved', 'Engraved', 'Letters are cut into the plate (easy to paint with a wash)'],
  ['cut', 'Cut-through', 'Letters are holes through the plate'],
];

export function TextSection({ compact = false }: { compact?: boolean }) {
  const text = useStore((s) => s.design.text);
  const fixedWidth = useStore((s) => s.design.plate.width.mode !== 'auto');
  useStore((s) => s.ui.assetsVersion); // re-render when a font is uploaded
  const update = useStore((s) => s.update);
  const fileRef = useRef<HTMLInputElement>(null);
  const fontLabelId = 'font-picker-label';
  const fonts = [...FONTS, ...userFontList()];

  return (
    <Section title={compact ? null : '2 · Text'} aside={<FitBadge long={compact} />}>
      <label className="control">
        Name
        <input
          className="field"
          value={text.line1}
          maxLength={MAX_TEXT_LENGTH}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => update((d) => void (d.text.line1 = e.target.value), 'text.line1')}
        />
      </label>
      <label className="control">
        Line 2 (rank or title, optional)
        <input
          className="field"
          value={text.line2}
          maxLength={MAX_TEXT_LENGTH}
          spellCheck={false}
          autoComplete="off"
          placeholder="e.g. Sergeant"
          onChange={(e) => update((d) => void (d.text.line2 = e.target.value), 'text.line2')}
        />
      </label>

      <div className="control">
        <span id={fontLabelId}>Font</span>
        <div className="grid cols-2" role="radiogroup" aria-labelledby={fontLabelId}>
          {fonts.map((f) => (
            <Chip
              key={f.id}
              role="radio"
              aria-checked={text.fontId === f.id}
              aria-pressed={undefined}
              className={`font-option${text.fontId === f.id ? ' on' : ''}`}
              title={`${f.name}: ${f.hint}`}
              style={{ fontFamily: `'${f.cssFamily}', serif`, fontWeight: f.cssWeight }}
              onClick={() => update((d) => void (d.text.fontId = f.id), 'text.font')}
            >
              {f.name}
            </Chip>
          ))}
          <Chip
            className="font-option upload"
            title="Use a .ttf or .otf from your computer. It is read on this device and never uploaded."
            onClick={() => fileRef.current?.click()}
          >
            + Your font…
          </Chip>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".ttf,.otf,.woff,font/ttf,font/otf"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFont(f);
            e.target.value = '';
          }}
        />
      </div>

      <div className="grid cols-2 gap-12">
        <Slider
          label="Letter height"
          value={text.size1}
          min={LIMITS.size1[0]}
          max={LIMITS.size1[1]}
          step={0.1}
          onChange={(v) => update((d) => void (d.text.size1 = v), 'text.size1')}
        />
        <Slider
          label="Spacing"
          value={text.spacing}
          min={0}
          max={LIMITS.spacing[1]}
          step={0.05}
          onChange={(v) => update((d) => void (d.text.spacing = v), 'text.spacing')}
        />
        {text.line2.trim() && (
          <Slider
            label="Line 2 height"
            value={text.size2}
            min={LIMITS.size2[0]}
            max={LIMITS.size2[1]}
            step={0.1}
            onChange={(v) => update((d) => void (d.text.size2 = v), 'text.size2')}
          />
        )}
        <Slider
          label="Thicken strokes"
          value={text.thicken}
          min={LIMITS.thicken[0]}
          max={LIMITS.thicken[1]}
          step={0.01}
          onChange={(v) => update((d) => void (d.text.thicken = v), 'text.thicken')}
        />
      </div>

      <div className="grid cols-2">
        <Check
          label="UPPERCASE"
          checked={text.uppercase}
          onChange={(v) => update((d) => void (d.text.uppercase = v), 'text.uppercase')}
        />
        <Check
          label="Auto-shrink to fit"
          checked={text.autoShrink}
          onChange={(v) => update((d) => void (d.text.autoShrink = v), 'text.autoShrink')}
        />
      </div>

      <div className="grid cols-3" role="radiogroup" aria-label="Text mode">
        {MODES.map(([id, label, hint]) => (
          <Chip
            key={id}
            role="radio"
            aria-checked={text.mode === id}
            aria-pressed={undefined}
            className={text.mode === id ? 'on' : ''}
            title={hint}
            onClick={() => update((d) => void (d.text.mode = id), 'text.mode')}
          >
            {compact && id === 'cut' ? 'Cut' : label}
          </Chip>
        ))}
      </div>

      <div className="grid cols-2 gap-12">
        <Slider
          label={text.mode === 'engraved' ? 'Engrave depth' : 'Text depth'}
          value={text.depth}
          min={LIMITS.depth[0]}
          max={LIMITS.depth[1]}
          step={0.05}
          disabled={text.mode === 'cut'}
          onChange={(v) => update((d) => void (d.text.depth = v), 'text.depth')}
        />
        <div className="control">
          <span>Align{fixedWidth ? '' : ' (fixed width)'}</span>
          <div className="grid cols-3" role="radiogroup" aria-label="Text alignment">
            {(['left', 'center', 'right'] as const).map((a) => (
              <Chip
                key={a}
                role="radio"
                aria-checked={text.align === a}
                aria-pressed={undefined}
                className={`slim${text.align === a ? ' on' : ''}`}
                aria-label={`Align ${a}`}
                onClick={() => update((d) => void (d.text.align = a), 'text.align')}
              >
                {a === 'left' ? 'L' : a === 'center' ? 'C' : 'R'}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
