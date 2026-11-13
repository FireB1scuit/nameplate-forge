import {
  CUSTOM_PRESET_ID,
  findPreset,
  MDF_HEIGHT,
  presetsFor,
  type BaseShape,
} from '../../data/bases';
import { LIMITS, resolveBase } from '../../state/schema';
import { useStore } from '../../state/store';
import { Chip, NumberField, Section } from '../components/controls';

type ShapeTab = 'round' | 'oval' | 'square';
const tabOf = (s: BaseShape): ShapeTab => (s === 'rect' ? 'square' : s);
const FIRST: Record<ShapeTab, string> = { round: 'r32', oval: 'o60x35', square: 's25' };

export function BaseSection({ compact = false }: { compact?: boolean }) {
  const base = useStore((s) => s.design.base);
  const update = useStore((s) => s.update);
  const isCustom = base.presetId === CUSTOM_PRESET_ID;
  const preset = findPreset(base.presetId);
  const tab = tabOf(base.shape);
  const r = resolveBase(base);
  const twoAxes = base.shape === 'oval' || base.shape === 'rect' || (isCustom && tab !== 'round');

  const pickPreset = (id: string) =>
    update((d) => {
      const p = findPreset(id);
      if (!p) return;
      d.base.shape = p.shape;
      d.base.presetId = p.id;
      d.base.bottom = [...p.bottom];
      d.base.top = [...p.top];
      d.base.height = p.height;
      // square bases: snap the plate onto a face
      if (p.shape === 'square' || p.shape === 'rect') {
        d.plate.angleDeg = Math.round(d.plate.angleDeg / 90) * 90;
        if (d.plate.angleDeg === -180) d.plate.angleDeg = 180;
      }
    }, 'base.preset');

  const goCustom = () =>
    update((d) => {
      d.base.presetId = CUSTOM_PRESET_ID;
      // keep what is on screen: a preset with an MDF edge is drawn at MDF height
      d.base.height = r.H;
    }, 'base.custom');

  const setSize = (which: 'bottom' | 'top', axis: 0 | 1, v: number) =>
    update((d) => {
      const arr = [...d.base[which]] as [number, number];
      arr[axis] = v;
      if (!twoAxes) arr[1] = arr[0];
      d.base[which] = arr;
      if (which === 'bottom') {
        d.base.top = [
          Math.min(d.base.top[0], d.base.bottom[0]),
          Math.min(d.base.top[1], d.base.bottom[1]),
        ];
      }
      if (tab === 'square')
        d.base.shape = d.base.bottom[0] === d.base.bottom[1] ? 'square' : 'rect';
    }, `base.${which}${axis}`);

  const shapeLabel =
    base.shape === 'rect' ? 'Rectangle' : base.shape[0].toUpperCase() + base.shape.slice(1);

  return (
    <Section
      title={compact ? null : '1 · Base'}
      aside={
        <span className="note">
          {isCustom ? `Custom ${shapeLabel.toLowerCase()}` : 'Standard sizes'}
        </span>
      }
    >
      <div className="grid cols-4" role="group" aria-label="Base shape">
        {(['round', 'oval', 'square'] as const).map((s) => (
          <Chip key={s} on={tab === s && !isCustom} onClick={() => pickPreset(FIRST[s])}>
            {s === 'round' ? 'Round' : s === 'oval' ? 'Oval' : 'Square'}
          </Chip>
        ))}
        <Chip on={isCustom} onClick={goCustom} title="Type your own base dimensions">
          Custom
        </Chip>
      </div>

      {!isCustom && (
        <div
          className={`grid ${tab === 'round' ? 'cols-6' : tab === 'oval' ? 'cols-4' : 'cols-4'}`}
          role="group"
          aria-label="Base size (mm)"
        >
          {presetsFor(tab === 'square' ? 'square' : tab).map((p) => (
            <Chip
              key={p.id}
              on={p.id === base.presetId}
              onClick={() => pickPreset(p.id)}
              aria-label={`${p.label} mm ${p.shape} base`}
            >
              {p.label}
            </Chip>
          ))}
        </div>
      )}

      {isCustom && (
        <>
          <div className="grid cols-3" role="group" aria-label="Custom base shape">
            {(['round', 'oval', 'square'] as const).map((s) => (
              <Chip
                key={s}
                on={tab === s}
                onClick={() =>
                  update((d) => {
                    d.base.shape =
                      s === 'square' && d.base.bottom[0] !== d.base.bottom[1] ? 'rect' : s;
                    if (s === 'round') {
                      d.base.bottom = [d.base.bottom[0], d.base.bottom[0]];
                      d.base.top = [d.base.top[0], d.base.top[0]];
                    }
                  }, 'base.shape')
                }
              >
                {s === 'round' ? 'Round' : s === 'oval' ? 'Oval' : 'Square / rect'}
              </Chip>
            ))}
          </div>
          <div
            className={`grid ${twoAxes ? 'cols-2' : base.edge === 'vertical' ? 'cols-2' : 'cols-3'} gap-12`}
          >
            <NumberField
              label={
                twoAxes
                  ? 'Bottom width (mm)'
                  : tab === 'round'
                    ? 'Bottom Ø (mm)'
                    : 'Bottom side (mm)'
              }
              value={base.bottom[0]}
              min={LIMITS.baseDiameter[0]}
              max={LIMITS.baseDiameter[1]}
              step={0.1}
              onChange={(v) => setSize('bottom', 0, v)}
            />
            {twoAxes && (
              <NumberField
                label="Bottom depth (mm)"
                value={base.bottom[1]}
                min={LIMITS.baseDiameter[0]}
                max={LIMITS.baseDiameter[1]}
                step={0.1}
                onChange={(v) => setSize('bottom', 1, v)}
              />
            )}
            {base.edge === 'sloped' && (
              <NumberField
                label={
                  twoAxes ? 'Top width (mm)' : tab === 'round' ? 'Top Ø (mm)' : 'Top side (mm)'
                }
                value={base.top[0]}
                min={LIMITS.baseDiameter[0]}
                max={base.bottom[0]}
                step={0.1}
                onChange={(v) => setSize('top', 0, v)}
              />
            )}
            {base.edge === 'sloped' && twoAxes && (
              <NumberField
                label="Top depth (mm)"
                value={base.top[1]}
                min={LIMITS.baseDiameter[0]}
                max={base.bottom[1]}
                step={0.1}
                onChange={(v) => setSize('top', 1, v)}
              />
            )}
            <NumberField
              label="Height (mm)"
              value={base.height}
              min={LIMITS.baseHeight[0]}
              max={LIMITS.baseHeight[1]}
              step={0.1}
              onChange={(v) => update((d) => void (d.base.height = v), 'base.height')}
            />
          </div>
        </>
      )}

      <div className="grid cols-2" role="group" aria-label="Edge type">
        <Chip
          on={base.edge === 'sloped'}
          onClick={() => update((d) => void (d.base.edge = 'sloped'), 'base.edge')}
        >
          Sloped plastic rim
        </Chip>
        <Chip
          on={base.edge === 'vertical'}
          onClick={() => update((d) => void (d.base.edge = 'vertical'), 'base.edge')}
        >
          Flat MDF edge
        </Chip>
      </div>

      {preset?.unmeasured && (
        <p className="note">
          Top{' '}
          {base.edge === 'vertical'
            ? preset.label
            : `${preset.top[0]}${preset.top[0] !== preset.top[1] ? `×${preset.top[1]}` : ''}`}{' '}
          mm · height {base.edge === 'vertical' ? MDF_HEIGHT : preset.height} mm are estimates until
          real bases are measured. Use Custom if yours differ.
        </p>
      )}
      {base.shape === 'oval' && (
        <p className="note">
          Ovals use an approximate fit: very long plates round the tight ends may need a slightly
          bigger fit gap.
        </p>
      )}
    </Section>
  );
}
