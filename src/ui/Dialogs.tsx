import { useEffect, useMemo, useState } from 'react';
import { FONTS } from '../data/fonts';
import { THEMES } from '../data/themes';
import type { BatchRow, ExportFormat, Orientation } from '../geometry/exporter';
import { geometry } from '../geometry/client';
import { applyTheme, type Design } from '../state/schema';
import { useStore } from '../state/store';
import {
  applyPreset,
  deletePreset,
  exportBatchFile,
  exportFile,
  loadPresets,
  savePreset,
  useToast,
  type SavedPreset,
} from './actions';
import { Check, Chip } from './components/controls';
import { Modal } from './components/Modal';
import { ThemeCard } from './panel/StyleSection';

const close = () => useStore.getState().setUi({ dialog: null });

function ThemeGallery() {
  const themeId = useStore((s) => s.design.style.themeId);
  const update = useStore((s) => s.update);
  return (
    <Modal title="Plate styles" onClose={close} wide>
      <p className="note">
        A style sets the outline, border, end-caps, surface and font. You can change any of them
        afterwards under Style → Customise layers.
      </p>
      <div className="gallery" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => (
          <ThemeCard
            key={t.id}
            id={t.id}
            big
            on={themeId === t.id}
            onPick={() => {
              update((d) => applyTheme(d, t.id), 'style.theme');
              close();
            }}
          />
        ))}
      </div>
    </Modal>
  );
}

function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<[T, string, boolean?]>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="control">
      <span>{label}</span>
      <div className={`grid cols-${options.length}`} role="radiogroup" aria-label={label}>
        {options.map(([v, l, disabled]) => (
          <Chip
            key={v}
            role="radio"
            aria-checked={value === v}
            aria-pressed={undefined}
            className={value === v ? 'on' : ''}
            disabled={disabled}
            onClick={() => onChange(v)}
          >
            {l}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function ExportDialog() {
  const printer = useStore((s) => s.ui.printer);
  const [format, setFormat] = useState<ExportFormat>('stl');
  const [orientation, setOrientation] = useState<Orientation>('inplace');
  const [withBase, setWithBase] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await exportFile(useStore.getState().design, { format, orientation, withBase, printer });
      close();
    } catch (e) {
      console.error(e);
      useToast.getState().show(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Export"
      onClose={close}
      footer={
        <>
          <Chip className="tall" onClick={close}>
            Cancel
          </Chip>
          <Chip className="tall primary" disabled={busy} onClick={() => void run()}>
            {busy ? 'Forging…' : `Download ${format.toUpperCase()}`}
          </Chip>
        </>
      }
    >
      <Seg
        label="Format"
        value={format}
        onChange={setFormat}
        options={[
          ['stl', 'STL (one solid)'],
          ['3mf', '3MF (plate + text parts)'],
        ]}
      />
      <Seg
        label="Orientation"
        value={withBase ? 'inplace' : orientation}
        onChange={setOrientation}
        options={[
          ['inplace', 'In place on the base'],
          ['flat', 'Flat for printing', withBase],
        ]}
      />
      <Check
        label="Include the base (to check the fit or print both)"
        checked={withBase}
        onChange={setWithBase}
      />
      <p className="note">
        {format === '3mf'
          ? 'The text, border and icons are a separate object, so you can give them their own filament or colour.'
          : orientation === 'flat' && !withBase
            ? 'The plate is turned so its back faces the build plate. It keeps its curve.'
            : 'Units are millimetres. The plate sits exactly where it goes on the base.'}
      </p>
    </Modal>
  );
}

interface Row {
  line1: string;
  line2: string;
}

function parseRows(text: string): Row[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 60)
    .map((l) => {
      const [a, ...rest] = l.split(/[,;\t]/);
      return { line1: a.trim(), line2: rest.join(',').trim() };
    });
}

function BatchDialog() {
  const design = useStore((s) => s.design);
  const printer = useStore((s) => s.ui.printer);
  const setDesign = useStore((s) => s.setDesign);
  const [text, setText] = useState('Brother Kai, Sergeant\nBrother Tarus\nBrother Vel, Veteran');
  const [checks, setChecks] = useState<BatchRow[] | null>(null);
  const [mode, setMode] = useState<'zip' | 'sprue'>('zip');
  const [format, setFormat] = useState<ExportFormat>('stl');
  const [orientation, setOrientation] = useState<Orientation>('flat');
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const rows = useMemo(() => parseRows(text), [text]);
  const designs = useMemo(
    () =>
      rows.map((r): Design => {
        const d = structuredClone(design);
        d.text.line1 = r.line1;
        d.text.line2 = r.line2;
        return d;
      }),
    [rows, design],
  );

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      geometry()
        .planBatch(designs)
        .then((res) => live && setChecks(res))
        .catch(() => live && setChecks(null));
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [designs]);

  const run = async () => {
    setProgress([0, designs.length]);
    try {
      await exportBatchFile(designs, { mode, format, orientation, printer }, (d, t) =>
        setProgress([d, t]),
      );
    } catch (e) {
      console.error(e);
      useToast
        .getState()
        .show(`Batch export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProgress(null);
    }
  };

  return (
    <Modal
      title="Squad batch"
      onClose={close}
      wide
      footer={
        <>
          {progress && (
            <progress
              className="grow"
              max={progress[1]}
              value={progress[0]}
              aria-label="Export progress"
            />
          )}
          <Chip className="tall" onClick={close}>
            Close
          </Chip>
          <Chip
            className="tall primary"
            disabled={!rows.length || !!progress}
            onClick={() => void run()}
          >
            {progress
              ? `Forging ${progress[0]}/${progress[1]}…`
              : mode === 'sprue'
                ? `Download sprue (${rows.length})`
                : `Download ZIP (${rows.length})`}
          </Chip>
        </>
      }
    >
      <p className="note">
        One plate per line: <code>Name, Rank</code>. Every plate uses the current base, style and
        settings. Up to 60 plates.
      </p>
      <textarea
        className="field area"
        rows={6}
        value={text}
        spellCheck={false}
        aria-label="Names, one per line"
        onChange={(e) => setText(e.target.value)}
      />
      <div className="batch-table" role="table" aria-label="Fit check">
        <div role="row" className="batch-row head">
          <span role="columnheader">#</span>
          <span role="columnheader">Name</span>
          <span role="columnheader">Line 2</span>
          <span role="columnheader">Fit</span>
          <span role="columnheader" className="sr-only">
            Edit
          </span>
        </div>
        {rows.map((r, i) => {
          const c = checks?.[i];
          const problems = c?.warnings.filter((w) => w.level === 'warn') ?? [];
          const status = !c
            ? '…'
            : c.fit.fits
              ? 'Fits'
              : c.fit.shrunk && !problems.some((w) => w.code === 'overflow')
                ? `Shrunk to ${c.fit.sizeUsed.toFixed(1)} mm`
                : 'Too long';
          const cls = !c ? 'note' : c.fit.fits ? 'ok' : status === 'Too long' ? 'error' : 'warn';
          return (
            <div role="row" className="batch-row" key={i}>
              <span role="cell">{i + 1}</span>
              <span role="cell">{r.line1 || <em className="note">blank</em>}</span>
              <span role="cell">{r.line2}</span>
              <span role="cell" className={cls}>
                {status}
              </span>
              <span role="cell">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setDesign(designs[i]);
                    close();
                  }}
                >
                  Edit
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <div className="grid cols-2 gap-12">
        <Seg
          label="Output"
          value={mode}
          onChange={setMode}
          options={[
            ['zip', 'ZIP of files'],
            ['sprue', 'One print sprue'],
          ]}
        />
        {mode === 'zip' ? (
          <Seg
            label="Files"
            value={format}
            onChange={setFormat}
            options={[
              ['stl', 'STL'],
              ['3mf', '3MF'],
            ]}
          />
        ) : (
          <p className="note">
            The sprue lays the plates flat in a frame of 1.2 mm bars with 0.5 mm gates: print it in
            one go and clip the plates off.
          </p>
        )}
      </div>
      {mode === 'zip' && (
        <Seg
          label="Orientation"
          value={orientation}
          onChange={setOrientation}
          options={[
            ['inplace', 'In place'],
            ['flat', 'Flat for printing'],
          ]}
        />
      )}
    </Modal>
  );
}

function PresetsDialog() {
  const [list, setList] = useState<SavedPreset[]>(() => loadPresets());
  const [name, setName] = useState('');
  return (
    <Modal title="Saved styles" onClose={close}>
      <p className="note">
        Save the current base, style and settings (not the name) to reuse for a whole squad. Saved
        in this browser only.
      </p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setList(savePreset(name.trim(), useStore.getState().design));
          setName('');
        }}
      >
        <input
          className="field"
          placeholder="e.g. Blue squad, 32 mm"
          value={name}
          maxLength={40}
          aria-label="Preset name"
          onChange={(e) => setName(e.target.value)}
        />
        <Chip className="tall primary" type="submit" disabled={!name.trim()}>
          Save
        </Chip>
      </form>
      {list.length === 0 ? (
        <p className="note">Nothing saved yet.</p>
      ) : (
        <ul className="preset-list">
          {list.map((p) => (
            <li key={p.name}>
              <span>
                {p.name}
                <small className="note"> · {new Date(p.savedAt).toLocaleDateString()}</small>
              </span>
              <Chip
                onClick={() => {
                  applyPreset(p);
                  close();
                }}
              >
                Apply
              </Chip>
              <Chip aria-label={`Delete ${p.name}`} onClick={() => setList(deletePreset(p.name))}>
                Delete
              </Chip>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function HelpDialog() {
  const base = import.meta.env.BASE_URL;
  return (
    <Modal title="How to print and attach" onClose={close} wide>
      <div className="prose">
        <h3>1. Pick the base and check the fit</h3>
        <p>
          Choose your base size and edge. Standard sizes are estimates: if your base differs,
          measure it with calipers (bottom and top diameter, rim height) and use <b>Custom</b>. The
          <b> fit gap</b> (default 0.1 mm) leaves room for glue; raise it to 0.15–0.2 mm if your
          printer runs slightly large.
        </p>
        <h3>2. Resin printers</h3>
        <ul>
          <li>
            Export <b>Flat for printing</b> (back face towards the build plate) or in place.
          </li>
          <li>
            Angle it about 30–45° in your slicer and put light supports on the back face only, so
            the lettering stays clean.
          </li>
          <li>
            Letters 2.5–3 mm tall and 0.4 mm proud read well. Keep strokes ≥ 0.3 mm (the print check
            flags thinner ones).
          </li>
          <li>Wash and cure fully before gluing: uncured resin stops glue from bonding.</li>
        </ul>
        <h3>3. FDM printers</h3>
        <ul>
          <li>
            Switch the printer profile to <b>FDM</b> and apply the FDM-friendly sizes: 1.2 mm plate,
            0.6 mm text, 4 mm letters.
          </li>
          <li>
            Use a 0.2 or 0.25 mm nozzle if you have one, 0.08–0.12 mm layers, and print flat, back
            face down.
          </li>
          <li>Engraved text prints more cleanly than raised text on FDM.</li>
          <li>
            3MF export keeps the text as its own part for a colour change or a second filament.
          </li>
        </ul>
        <h3>4. Attach</h3>
        <ul>
          <li>Dry-fit first. Sand the back face lightly if it rocks.</li>
          <li>
            Plastic bases: a thin line of superglue (gel is easier) or plastic cement on the rim.
          </li>
          <li>MDF bases: superglue or PVA; seal raw MDF with a coat of primer first.</li>
          <li>
            The <b>top lip</b> option hooks over the edge to line the plate up for you.
          </li>
        </ul>
        <h3>5. Paint</h3>
        <ul>
          <li>Paint plates while still on the sprue (use the batch sprue), then clip and glue.</li>
          <li>Raised text: paint the plate, then drybrush or carefully edge the letters.</li>
          <li>
            Engraved text: base coat, then run a dark wash into the letters and wipe the surface.
          </li>
          <li>
            The <b>Painted</b> view toggle previews text in a contrasting colour.
          </li>
        </ul>
        <h3>Privacy</h3>
        <p>
          Everything runs in your browser. Fonts and SVGs you upload are read on your device and
          never sent anywhere. Share links contain the design itself (no account, no server).
        </p>
        <h3>Licences</h3>
        <p>
          Nameplate Forge is MIT licensed. Geometry by{' '}
          <a href="https://github.com/elalish/manifold" target="_blank" rel="noreferrer">
            manifold-3d
          </a>{' '}
          (Apache-2.0). Bundled fonts are under the SIL Open Font License 1.1:
        </p>
        <ul className="licences">
          {[
            ...FONTS,
            {
              name: 'Inter (interface)',
              licence: 'Inter-OFL.txt',
              source: 'https://github.com/rsms/inter',
            },
          ].map((f) => (
            <li key={f.name}>
              {f.name}:{' '}
              <a href={`${base}fonts/${f.licence}`} target="_blank" rel="noreferrer">
                licence
              </a>{' '}
              ·{' '}
              <a href={f.source} target="_blank" rel="noreferrer">
                source
              </a>
            </li>
          ))}
        </ul>
        <p className="note">
          Unofficial fan tool, compatible with Games Workshop® bases. Not affiliated with or
          endorsed by Games Workshop. All trademarks belong to their owners. End-cap artwork is
          original.
        </p>
      </div>
    </Modal>
  );
}

export function Dialogs() {
  const dialog = useStore((s) => s.ui.dialog);
  switch (dialog) {
    case 'themes':
      return <ThemeGallery />;
    case 'export':
      return <ExportDialog />;
    case 'batch':
      return <BatchDialog />;
    case 'presets':
      return <PresetsDialog />;
    case 'help':
      return <HelpDialog />;
    default:
      return null;
  }
}
