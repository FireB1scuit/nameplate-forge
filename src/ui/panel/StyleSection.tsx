import { useRef } from 'react';
import {
  BORDERS,
  ENDCAP_ICONS,
  ICON_LABELS,
  OUTLINES,
  OUTLINE_LABELS,
  SURFACES,
  SURFACE_LABELS,
  THEMES,
  getTheme,
  type ThemeId,
} from '../../data/themes';
import { LIMITS, applyTheme } from '../../state/schema';
import { useStore } from '../../state/store';
import { uploadIcon, userIconList } from '../actions';
import { Chip, Section, Slider } from '../components/controls';
import { ThemeThumb } from '../components/ThemeThumb';

export function ThemeCard({
  id,
  on,
  onPick,
  big = false,
}: {
  id: ThemeId;
  on: boolean;
  onPick: () => void;
  big?: boolean;
}) {
  const t = getTheme(id);
  return (
    <Chip
      role="radio"
      aria-checked={on}
      aria-pressed={undefined}
      className={`theme-card${on ? ' on' : ''}${big ? ' big' : ''}`}
      title={t.description}
      onClick={onPick}
    >
      <ThemeThumb themeId={id} width={big ? 150 : 88} />
      <span>{t.name}</span>
      {big && <small className="note">{t.description}</small>}
    </Chip>
  );
}

export function StyleSection({ compact = false }: { compact?: boolean }) {
  const style = useStore((s) => s.design.style);
  useStore((s) => s.ui.assetsVersion);
  const update = useStore((s) => s.update);
  const setUi = useStore((s) => s.setUi);
  const fileRef = useRef<HTMLInputElement>(null);

  // the current theme first, then the first others, three cards in all
  const shown = [
    style.themeId,
    ...THEMES.map((t) => t.id).filter((id) => id !== style.themeId),
  ].slice(0, 3);
  const icons = [
    ...ENDCAP_ICONS.map((id) => ({ id: id as string, name: ICON_LABELS[id] })),
    ...userIconList(),
  ];

  return (
    <Section
      title={compact ? null : '3 · Style'}
      aside={
        <button type="button" className="link-btn" onClick={() => setUi({ dialog: 'themes' })}>
          All {THEMES.length} themes
        </button>
      }
    >
      <div className="grid cols-3" role="radiogroup" aria-label="Theme">
        {shown.map((id) => (
          <ThemeCard
            key={id}
            id={id}
            on={style.themeId === id}
            onPick={() => update((d) => applyTheme(d, id), 'style.theme')}
          />
        ))}
      </div>

      <details className="sub">
        <summary className="lbl">Customise layers</summary>
        <div className="section">
          <div className="control">
            <span>Outline</span>
            <div className="grid cols-3" role="radiogroup" aria-label="Outline">
              {OUTLINES.map((o) => (
                <Chip
                  key={o}
                  role="radio"
                  aria-checked={style.outline === o}
                  aria-pressed={undefined}
                  className={`slim${style.outline === o ? ' on' : ''}`}
                  onClick={() => update((d) => void (d.style.outline = o), 'style.outline')}
                >
                  {OUTLINE_LABELS[o]}
                </Chip>
              ))}
            </div>
          </div>

          <div className="control">
            <span>Border</span>
            <div className="grid cols-4" role="radiogroup" aria-label="Border">
              {BORDERS.map((b) => (
                <Chip
                  key={b}
                  role="radio"
                  aria-checked={style.border.type === b}
                  aria-pressed={undefined}
                  className={`slim${style.border.type === b ? ' on' : ''}`}
                  onClick={() => update((d) => void (d.style.border.type = b), 'style.border')}
                >
                  {b[0].toUpperCase() + b.slice(1)}
                </Chip>
              ))}
            </div>
          </div>
          {style.border.type !== 'none' && (
            <div className="grid cols-2 gap-12">
              <Slider
                label="Border width"
                value={style.border.width}
                min={LIMITS.borderWidth[0]}
                max={LIMITS.borderWidth[1]}
                step={0.05}
                onChange={(v) => update((d) => void (d.style.border.width = v), 'style.bw')}
              />
              <Slider
                label="Border inset"
                value={style.border.inset}
                min={LIMITS.borderInset[0]}
                max={LIMITS.borderInset[1]}
                step={0.05}
                onChange={(v) => update((d) => void (d.style.border.inset = v), 'style.bi')}
              />
            </div>
          )}

          <div className="control">
            <span>End-caps</span>
            <div className="grid cols-4" role="radiogroup" aria-label="End-cap icon">
              {icons.map((ic) => (
                <Chip
                  key={ic.id}
                  role="radio"
                  aria-checked={style.endCaps.icon === ic.id}
                  aria-pressed={undefined}
                  className={`slim icon-chip${style.endCaps.icon === ic.id ? ' on' : ''}`}
                  title={ic.name}
                  onClick={() => update((d) => void (d.style.endCaps.icon = ic.id), 'style.icon')}
                >
                  {ic.id !== 'none' && ic.id !== 'rivet' && !ic.id.startsWith('user:') && (
                    <img
                      src={`${import.meta.env.BASE_URL}endcaps/${ic.id}.svg`}
                      alt=""
                      width={14}
                      height={14}
                    />
                  )}
                  {ic.name}
                </Chip>
              ))}
              <Chip
                className="slim"
                title="Use your own SVG artwork. It is read on this device and never uploaded."
                onClick={() => fileRef.current?.click()}
              >
                + SVG…
              </Chip>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".svg,image/svg+xml"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadIcon(f);
                e.target.value = '';
              }}
            />
          </div>
          {style.endCaps.icon !== 'none' && (
            <div className="grid cols-2 gap-12">
              <Slider
                label={style.endCaps.icon === 'rivet' ? 'Rivet size' : 'Icon height'}
                value={style.endCaps.size}
                min={LIMITS.iconSize[0]}
                max={LIMITS.iconSize[1]}
                step={0.1}
                onChange={(v) => update((d) => void (d.style.endCaps.size = v), 'style.isize')}
              />
              {style.endCaps.icon !== 'rivet' && (
                <div className="control">
                  <span>Place</span>
                  <div className="grid cols-2" role="radiogroup" aria-label="Icon placement">
                    {(['ends', 'beside'] as const).map((p) => (
                      <Chip
                        key={p}
                        role="radio"
                        aria-checked={style.endCaps.place === p}
                        aria-pressed={undefined}
                        className={`slim${style.endCaps.place === p ? ' on' : ''}`}
                        onClick={() =>
                          update((d) => void (d.style.endCaps.place = p), 'style.iplace')
                        }
                      >
                        {p === 'ends' ? 'At ends' : 'By text'}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="control">
            <span>Surface</span>
            <div className="grid cols-3" role="radiogroup" aria-label="Surface texture">
              {SURFACES.map((s) => (
                <Chip
                  key={s}
                  role="radio"
                  aria-checked={style.surface === s}
                  aria-pressed={undefined}
                  className={`slim${style.surface === s ? ' on' : ''}`}
                  onClick={() => update((d) => void (d.style.surface = s), 'style.surface')}
                >
                  {SURFACE_LABELS[s]}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </details>
    </Section>
  );
}
