import { FONTS } from '../../data/fonts';
import { LIMITS, MAX_TEXT_LENGTH } from '../../state/schema';
import { useStore } from '../../state/store';
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

export function TextSection({ compact = false }: { compact?: boolean }) {
  const text = useStore((s) => s.design.text);
  const update = useStore((s) => s.update);
  const fontLabelId = 'font-picker-label';

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

      <div className="control">
        <span id={fontLabelId}>Font</span>
        <div className="grid cols-2" role="radiogroup" aria-labelledby={fontLabelId}>
          {FONTS.map((f) => (
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
        </div>
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

      <div className="grid cols-3" role="group" aria-label="Text mode">
        <Chip on>Raised</Chip>
        <Chip disabled title="Engraved text arrives with the style update (M2)">
          Engraved
        </Chip>
        <Chip disabled title="Cut-through text arrives with the style update (M2)">
          {compact ? 'Cut' : 'Cut-through'}
        </Chip>
      </div>

      <Slider
        label="Text depth"
        value={text.depth}
        min={LIMITS.depth[0]}
        max={LIMITS.depth[1]}
        step={0.05}
        onChange={(v) => update((d) => void (d.text.depth = v), 'text.depth')}
      />
    </Section>
  );
}
