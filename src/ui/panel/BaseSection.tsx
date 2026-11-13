import { CUSTOM_PRESET_ID, findPreset, MDF_HEIGHT, ROUND_PRESETS } from '../../data/bases';
import { LIMITS, resolveFrustum } from '../../state/schema';
import { useStore } from '../../state/store';
import { Chip, NumberField, Section } from '../components/controls';

export function BaseSection({ compact = false }: { compact?: boolean }) {
  const base = useStore((s) => s.design.base);
  const update = useStore((s) => s.update);
  const isCustom = base.presetId === CUSTOM_PRESET_ID;
  const preset = findPreset(base.presetId);
  const f = resolveFrustum(base);

  const pickPreset = (id: string) =>
    update((d) => {
      const p = findPreset(id);
      if (!p) return;
      d.base.presetId = p.id;
      d.base.bottom = [p.bottom, p.bottom];
      d.base.top = [p.top, p.top];
      d.base.height = p.height;
    }, 'base.preset');

  const goCustom = () =>
    update((d) => {
      d.base.presetId = CUSTOM_PRESET_ID;
      // keep what is on screen: a preset with an MDF edge is drawn at MDF height
      d.base.height = f.H;
    }, 'base.custom');

  return (
    <Section
      title={compact ? null : '1 · Base'}
      aside={<span className="note">Standard round sizes</span>}
    >
      <div className="grid cols-4" role="group" aria-label="Base shape">
        <Chip on={!isCustom} onClick={() => !isCustom || pickPreset('r32')}>
          Round
        </Chip>
        <Chip disabled title="Oval bases arrive in a later version">
          Oval
        </Chip>
        <Chip disabled title="Square bases arrive in a later version">
          Square
        </Chip>
        <Chip on={isCustom} onClick={goCustom}>
          Custom
        </Chip>
      </div>

      {!isCustom && (
        <div className="grid cols-6" role="group" aria-label="Base diameter (mm)">
          {ROUND_PRESETS.map((p) => (
            <Chip
              key={p.id}
              on={p.id === base.presetId}
              onClick={() => pickPreset(p.id)}
              aria-label={`${p.label} mm round base`}
            >
              {p.label}
            </Chip>
          ))}
        </div>
      )}

      {isCustom && (
        <div className={`grid ${base.edge === 'vertical' ? 'cols-2' : 'cols-3'} gap-12`}>
          <NumberField
            label="Bottom Ø (mm)"
            value={base.bottom[0]}
            min={LIMITS.baseDiameter[0]}
            max={LIMITS.baseDiameter[1]}
            step={0.1}
            onChange={(v) =>
              update((d) => {
                d.base.bottom = [v, v];
                if (d.base.top[0] > v) d.base.top = [v, v];
              }, 'base.bottom')
            }
          />
          {base.edge === 'sloped' && (
            <NumberField
              label="Top Ø (mm)"
              value={base.top[0]}
              min={LIMITS.baseDiameter[0]}
              max={base.bottom[0]}
              step={0.1}
              onChange={(v) => update((d) => void (d.base.top = [v, v]), 'base.top')}
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
          Top Ø {base.edge === 'vertical' ? base.bottom[0] : preset.top} mm · height{' '}
          {base.edge === 'vertical' ? MDF_HEIGHT : preset.height} mm are estimates until real bases
          are measured. Use Custom if yours differ.
        </p>
      )}
    </Section>
  );
}
