import { LIMITS } from '../../state/schema';
import { useStore } from '../../state/store';
import { Check, Chip, Section, Slider } from '../components/controls';

const FACES: Array<[number, string]> = [
  [0, 'Front'],
  [90, 'Right'],
  [180, 'Back'],
  [-90, 'Left'],
];

export function PlateSection({ compact = false }: { compact?: boolean }) {
  const plate = useStore((s) => s.design.plate);
  const shape = useStore((s) => s.design.base.shape);
  const stats = useStore((s) => s.build.result?.stats.plate);
  const update = useStore((s) => s.update);
  const mode = plate.width.mode;
  const square = shape === 'square' || shape === 'rect';

  const setMode = (m: 'auto' | 'mm' | 'deg') =>
    update((d) => {
      if (m === d.plate.width.mode) return;
      d.plate.width.mode = m;
      // start from the current width so the plate doesn't jump
      if (m === 'mm' && stats) d.plate.width.value = Math.round(stats.width * 10) / 10;
      if (m === 'deg' && stats)
        d.plate.width.value = Math.min(LIMITS.widthDeg[1], Math.round(stats.degrees));
    }, 'plate.wmode');

  return (
    <Section title={compact ? null : '4 · Plate & placement'}>
      <div className="grid cols-3" role="radiogroup" aria-label="Plate width">
        {(
          [
            ['auto', 'Auto-fit'],
            ['mm', mode === 'mm' ? `${plate.width.value.toFixed(1)} mm` : 'Fixed mm'],
            [
              'deg',
              square ? 'Of side' : mode === 'deg' ? `${plate.width.value.toFixed(0)}°` : 'Degrees',
            ],
          ] as const
        ).map(([m, label]) => (
          <Chip
            key={m}
            role="radio"
            aria-checked={mode === m}
            aria-pressed={undefined}
            className={mode === m ? 'on' : ''}
            onClick={() => setMode(m)}
            title={
              m === 'deg'
                ? square
                  ? '90° = the whole side'
                  : 'Width as an angle of the rim'
                : undefined
            }
          >
            {label}
          </Chip>
        ))}
      </div>

      {mode === 'mm' && (
        <Slider
          label="Plate width (along rim)"
          value={plate.width.value}
          min={LIMITS.widthMm[0]}
          max={160}
          step={0.5}
          onChange={(v) => update((d) => void (d.plate.width.value = v), 'plate.width')}
        />
      )}
      {mode === 'deg' && (
        <Slider
          label={square ? 'Plate width (90° = whole side)' : 'Plate width'}
          value={plate.width.value}
          min={LIMITS.widthDeg[0]}
          max={square ? 90 : LIMITS.widthDeg[1]}
          step={1}
          unit="°"
          onChange={(v) => update((d) => void (d.plate.width.value = v), 'plate.wdeg')}
        />
      )}
      {mode === 'auto' && (
        <Slider
          label={square ? 'Max width (90° = whole side)' : 'Max width (auto-fit)'}
          value={plate.maxDeg}
          min={LIMITS.maxDeg[0]}
          max={square ? 90 : LIMITS.maxDeg[1]}
          step={5}
          unit="°"
          onChange={(v) => update((d) => void (d.plate.maxDeg = v), 'plate.maxDeg')}
        />
      )}

      {square && (
        <div className="control">
          <span>Side</span>
          <div className="grid cols-4" role="radiogroup" aria-label="Base side">
            {FACES.map(([a, label]) => {
              const on = (Math.round(plate.angleDeg / 90) * 90 + 360) % 360 === (a + 360) % 360;
              return (
                <Chip
                  key={a}
                  role="radio"
                  aria-checked={on}
                  aria-pressed={undefined}
                  className={on ? 'on' : ''}
                  onClick={() => update((d) => void (d.plate.angleDeg = a), 'plate.angle')}
                >
                  {label}
                </Chip>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid cols-2 gap-12">
        <Slider
          label="Plate height"
          value={plate.height}
          min={LIMITS.plateHeight[0]}
          max={10}
          step={0.1}
          disabled={plate.blend}
          onChange={(v) => update((d) => void (d.plate.height = v), 'plate.height')}
        />
        <Slider
          label="Thickness"
          value={plate.thickness}
          min={LIMITS.thickness[0]}
          max={LIMITS.thickness[1]}
          step={0.1}
          onChange={(v) => update((d) => void (d.plate.thickness = v), 'plate.thickness')}
        />
        {!square && (
          <Slider
            label="Position"
            value={plate.angleDeg}
            min={LIMITS.angleDeg[0]}
            max={LIMITS.angleDeg[1]}
            step={1}
            unit="°"
            onChange={(v) => update((d) => void (d.plate.angleDeg = v), 'plate.angle')}
          />
        )}
        <Slider
          label="Fit gap"
          value={plate.gap}
          min={LIMITS.gap[0]}
          max={LIMITS.gap[1]}
          step={0.01}
          onChange={(v) => update((d) => void (d.plate.gap = v), 'plate.gap')}
        />
      </div>
    </Section>
  );
}

const FDM_DEFAULTS = { thickness: 1.2, depth: 0.6, size1: 4, thicken: 0.1 };

export function AdvancedSection() {
  const plate = useStore((s) => s.design.plate);
  const outline = useStore((s) => s.design.style.outline);
  const fireArc = useStore((s) => s.design.extras.fireArc);
  const shape = useStore((s) => s.design.base.shape);
  const printer = useStore((s) => s.ui.printer);
  const setUi = useStore((s) => s.setUi);
  const update = useStore((s) => s.update);
  const round = shape === 'round';

  return (
    <details className="advanced">
      <summary className="lbl">Advanced: fit, lip, fire arc, printer</summary>
      <div className="section">
        <div className="grid cols-2 gap-12">
          <Slider
            label="End padding"
            value={plate.padding}
            min={LIMITS.padding[0]}
            max={LIMITS.padding[1]}
            step={0.1}
            onChange={(v) => update((d) => void (d.plate.padding = v), 'plate.padding')}
          />
          <Slider
            label="Corner radius"
            value={plate.cornerRadius}
            min={LIMITS.cornerRadius[0]}
            max={LIMITS.cornerRadius[1]}
            step={0.1}
            disabled={outline !== 'rounded'}
            onChange={(v) => update((d) => void (d.plate.cornerRadius = v), 'plate.corner')}
          />
          <Slider
            label="Up / down"
            value={plate.offsetY}
            min={-3}
            max={3}
            step={0.05}
            disabled={plate.blend || plate.lip.on}
            onChange={(v) => update((d) => void (d.plate.offsetY = v), 'plate.offsetY')}
          />
        </div>

        <div className="grid cols-2">
          <Check
            label="Blend into rim"
            checked={plate.blend}
            onChange={(v) => update((d) => void (d.plate.blend = v), 'plate.blend')}
          />
          <Check
            label={round ? 'Top lip (hooks over edge)' : 'Top lip (round bases)'}
            checked={plate.lip.on}
            onChange={(v) => update((d) => void (d.plate.lip.on = v), 'plate.lip')}
          />
        </div>
        {plate.blend && (
          <p className="note">
            The plate covers the whole rim and its edges taper into the base, so it looks built in.
          </p>
        )}
        {plate.lip.on && (
          <div className="grid cols-2 gap-12">
            <Slider
              label="Lip depth"
              value={plate.lip.depth}
              min={LIMITS.lipDepth[0]}
              max={LIMITS.lipDepth[1]}
              step={0.1}
              onChange={(v) => update((d) => void (d.plate.lip.depth = v), 'plate.lipd')}
            />
            <Slider
              label="Lip thickness"
              value={plate.lip.thickness}
              min={LIMITS.lipThickness[0]}
              max={LIMITS.lipThickness[1]}
              step={0.05}
              onChange={(v) => update((d) => void (d.plate.lip.thickness = v), 'plate.lipt')}
            />
          </div>
        )}

        <div className="control">
          <span>Fire-arc notches (in the top edge)</span>
          <div className="grid cols-3" role="radiogroup" aria-label="Fire arc">
            {([0, 90, 180] as const).map((a) => (
              <Chip
                key={a}
                role="radio"
                aria-checked={fireArc === a}
                aria-pressed={undefined}
                className={fireArc === a ? 'on' : ''}
                onClick={() => update((d) => void (d.extras.fireArc = a), 'extras.fireArc')}
              >
                {a === 0 ? 'Off' : `${a}°`}
              </Chip>
            ))}
          </div>
        </div>

        <div className="control">
          <span>Printer profile</span>
          <div className="grid cols-2" role="radiogroup" aria-label="Printer profile">
            {(
              [
                ['resin', 'Resin (min 0.3 mm)'],
                ['fdm', 'FDM (min 0.8 mm)'],
              ] as const
            ).map(([p, label]) => (
              <Chip
                key={p}
                role="radio"
                aria-checked={printer === p}
                aria-pressed={undefined}
                className={printer === p ? 'on' : ''}
                onClick={() => setUi({ printer: p })}
              >
                {label}
              </Chip>
            ))}
          </div>
          {printer === 'fdm' && (
            <button
              type="button"
              className="link-btn"
              onClick={() =>
                update((d) => {
                  d.plate.thickness = Math.max(d.plate.thickness, FDM_DEFAULTS.thickness);
                  d.text.depth = Math.max(d.text.depth, FDM_DEFAULTS.depth);
                  d.text.size1 = Math.max(d.text.size1, FDM_DEFAULTS.size1);
                  d.text.thicken = Math.max(d.text.thicken, FDM_DEFAULTS.thicken);
                  d.plate.height = Math.max(d.plate.height, d.text.size1 + 1.6);
                })
              }
            >
              Apply FDM-friendly sizes (1.2 mm plate, 0.6 mm text, 4 mm letters)
            </button>
          )}
        </div>
      </div>
    </details>
  );
}
