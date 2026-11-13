import { LIMITS } from '../../state/schema';
import { useStore } from '../../state/store';
import { Chip, Section, Slider } from '../components/controls';

export function PlateSection({ compact = false }: { compact?: boolean }) {
  const plate = useStore((s) => s.design.plate);
  const builtWidth = useStore((s) => s.build.result?.stats.plate.width);
  const update = useStore((s) => s.update);
  const fixed = plate.width.mode === 'mm';

  return (
    <Section title={compact ? null : '4 · Plate & placement'}>
      <div className="grid cols-2" role="group" aria-label="Plate width">
        <Chip
          on={!fixed}
          onClick={() => update((d) => void (d.plate.width.mode = 'auto'), 'plate.wmode')}
        >
          Width: Auto-fit
        </Chip>
        <Chip
          on={fixed}
          onClick={() =>
            update((d) => {
              d.plate.width.mode = 'mm';
              // start from the current auto width so the plate doesn't jump
              if (!fixed && builtWidth) d.plate.width.value = Math.round(builtWidth * 10) / 10;
            }, 'plate.wmode')
          }
        >
          Fixed {(fixed ? plate.width.value : (builtWidth ?? plate.width.value)).toFixed(1)} mm
        </Chip>
      </div>

      {fixed ? (
        <Slider
          label="Plate width (along rim)"
          value={plate.width.value}
          min={LIMITS.widthMm[0]}
          max={120}
          step={0.5}
          onChange={(v) => update((d) => void (d.plate.width.value = v), 'plate.width')}
        />
      ) : (
        <Slider
          label="Max width (auto-fit)"
          value={plate.maxDeg}
          min={LIMITS.maxDeg[0]}
          max={LIMITS.maxDeg[1]}
          step={5}
          unit="°"
          onChange={(v) => update((d) => void (d.plate.maxDeg = v), 'plate.maxDeg')}
        />
      )}

      <div className="grid cols-2 gap-12">
        <Slider
          label="Plate height"
          value={plate.height}
          min={LIMITS.plateHeight[0]}
          max={8}
          step={0.1}
          onChange={(v) => update((d) => void (d.plate.height = v), 'plate.height')}
        />
        <Slider
          label="Thickness"
          value={plate.thickness}
          min={LIMITS.thickness[0]}
          max={2}
          step={0.1}
          onChange={(v) => update((d) => void (d.plate.thickness = v), 'plate.thickness')}
        />
        <Slider
          label="Position"
          value={plate.angleDeg}
          min={LIMITS.angleDeg[0]}
          max={LIMITS.angleDeg[1]}
          step={1}
          unit="°"
          onChange={(v) => update((d) => void (d.plate.angleDeg = v), 'plate.angle')}
        />
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

export function AdvancedSection() {
  const plate = useStore((s) => s.design.plate);
  const themeId = useStore((s) => s.design.style.themeId);
  const update = useStore((s) => s.update);

  return (
    <details className="advanced">
      <summary className="lbl">Advanced: padding, corners, offset, printer</summary>
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
            disabled={themeId !== 'plain'}
            onChange={(v) => update((d) => void (d.plate.cornerRadius = v), 'plate.corner')}
          />
          <Slider
            label="Up / down"
            value={plate.offsetY}
            min={-3}
            max={3}
            step={0.05}
            onChange={(v) => update((d) => void (d.plate.offsetY = v), 'plate.offsetY')}
          />
        </div>
        <div className="control">
          <span>Printer profile</span>
          <div className="grid cols-2" role="group" aria-label="Printer profile">
            <Chip on>Resin (min 0.3 mm)</Chip>
            <Chip disabled title="FDM profile arrives in a later version">
              FDM (min 0.8 mm)
            </Chip>
          </div>
        </div>
      </div>
    </details>
  );
}
