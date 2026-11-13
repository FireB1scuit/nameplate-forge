import { useId, useState, type ReactNode } from 'react';

export function Chip({
  on,
  children,
  className = '',
  ...rest
}: { on?: boolean; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`chip${on ? ' on' : ''} ${className}`}
      aria-pressed={on === undefined ? undefined : on}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Section({
  title,
  aside,
  children,
}: {
  /** null hides the header (phone bottom sheet) */
  title: string | null;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="section" aria-labelledby={title ? id : undefined}>
      {title !== null && (
        <div className="row section-head">
          <h2 className="lbl" id={id}>
            {title}
          </h2>
          {aside}
        </div>
      )}
      {title === null && aside && <div className="row section-head">{aside}</div>}
      {children}
    </section>
  );
}

function fmt(v: number, step: number): string {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return v.toFixed(decimals);
}

/**
 * Range slider with a numeric readout. Tapping the readout turns it into a number input
 * (plan.md §4: "Sliders show a numeric value. Tapping the value opens a number input").
 */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit = 'mm',
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const commit = () => {
    const n = Number(draft.replace(',', '.'));
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
    setEditing(false);
  };
  const shown = `${fmt(value, step)}${unit === '°' ? '°' : ` ${unit}`}`;
  return (
    <div className="control">
      <span className="row">
        <label htmlFor={id}>{label}</label>
        {editing ? (
          <input
            className="value-input"
            type="number"
            inputMode="decimal"
            autoFocus
            min={min}
            max={max}
            step={step}
            value={draft}
            aria-label={`${label} (${unit})`}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="value-btn"
            title="Type a value"
            aria-label={`${label}: ${shown}. Type a value`}
            disabled={disabled}
            onClick={() => {
              setDraft(fmt(value, step));
              setEditing(true);
            }}
          >
            {shown}
          </button>
        )}
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (s: string) => {
    const n = Number(s.replace(',', '.'));
    if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
  };
  return (
    <label className="control">
      {label}
      <input
        className="field"
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft ?? String(value)}
        onChange={(e) => {
          setDraft(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}

export function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
