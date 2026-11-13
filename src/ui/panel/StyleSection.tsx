import { THEMES, type ThemeId } from '../../data/themes';
import { useStore } from '../../state/store';
import { Chip, Section } from '../components/controls';
import { PlainThumb, RivetedThumb } from '../components/icons';

const THUMBS: Record<ThemeId, () => React.JSX.Element> = {
  plain: PlainThumb,
  riveted: RivetedThumb,
};

export function StyleSection({ compact = false }: { compact?: boolean }) {
  const themeId = useStore((s) => s.design.style.themeId);
  const update = useStore((s) => s.update);

  return (
    <Section
      title={compact ? null : '3 · Style'}
      aside={<span className="note">More themes coming</span>}
    >
      <div className="grid cols-3" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => {
          const Thumb = THUMBS[t.id];
          return (
            <Chip
              key={t.id}
              role="radio"
              aria-checked={themeId === t.id}
              aria-pressed={undefined}
              className={`theme-card${themeId === t.id ? ' on' : ''}`}
              title={t.description}
              onClick={() => update((d) => void (d.style.themeId = t.id), 'style.theme')}
            >
              <Thumb />
              <span>{t.name}</span>
            </Chip>
          );
        })}
      </div>
    </Section>
  );
}
