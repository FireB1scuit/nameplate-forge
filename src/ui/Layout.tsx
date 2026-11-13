import { useEffect, useState } from 'react';
import { resolveBase } from '../state/schema';
import { useStore, type CameraPreset, type MobileTab, type UiState } from '../state/store';
import { Viewport } from '../viewer/Viewport';
import { copyShareLink, screenshot, useToast } from './actions';
import { Dialogs } from './Dialogs';
import { Chip } from './components/controls';
import {
  BaseTabIcon,
  DownloadIcon,
  LogoMark,
  PlateTabIcon,
  RedoIcon,
  ShareIcon,
  StyleTabIcon,
  TextTabIcon,
  UndoIcon,
} from './components/icons';
import { BaseSection } from './panel/BaseSection';
import { AdvancedSection, PlateSection } from './panel/PlateSection';
import { StyleSection } from './panel/StyleSection';
import { TextSection } from './panel/TextSection';
import { PrintCheck } from './PrintCheck';
import { usePrintSummary } from './printSummary';

/** Ctrl/Cmd+Z, Ctrl+Shift+Z / Ctrl+Y — but not while typing in a text field. */
function useUndoKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = e.target as HTMLElement | null;
      if (el && el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'text') return;
      if (el?.tagName === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        useStore.getState().undo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        useStore.getState().redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function DesignName() {
  const line1 = useStore((s) => s.design.text.line1.trim());
  const pretty = line1
    ? line1.toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase())
    : 'Blank plate';
  return <span className="design-name">Untitled — {pretty}</span>;
}

function TopBar({ phone }: { phone: boolean }) {
  const canUndo = useStore((s) => s.history.past.length > 0);
  const canRedo = useStore((s) => s.history.future.length > 0);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const setUi = useStore((s) => s.setUi);
  const share = () => void copyShareLink(useStore.getState().design);

  return (
    <header className="topbar">
      <div className="brand">
        {!phone && <LogoMark />}
        <h1 className="wordmark" style={{ margin: 0 }}>
          NAMEPLATE FORGE
        </h1>
      </div>
      {!phone && <DesignName />}
      <div className="spacer" />
      {!phone && (
        <>
          <button
            type="button"
            className="ibtn"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            disabled={!canUndo}
            onClick={undo}
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            className="ibtn"
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!canRedo}
            onClick={redo}
          >
            <RedoIcon />
          </button>
          <Chip
            className="tall"
            onClick={() => setUi({ dialog: 'presets' })}
            title="Save and reuse styles"
          >
            Saved styles
          </Chip>
          <Chip
            className="tall"
            onClick={() => setUi({ dialog: 'batch' })}
            title="A plate for every name in a squad"
          >
            Squad batch
          </Chip>
          <button
            type="button"
            className="ibtn"
            aria-label="How to print and attach"
            title="How to print and attach"
            onClick={() => setUi({ dialog: 'help' })}
          >
            <b aria-hidden="true">?</b>
          </button>
        </>
      )}
      {phone && <PhoneMenu />}
      <Chip
        className="tall"
        onClick={share}
        aria-label="Copy share link"
        title="Copy a link to this design"
      >
        <ShareIcon />
        {!phone && 'Share link'}
      </Chip>
      <Chip className="tall primary" onClick={() => setUi({ dialog: 'export' })}>
        {!phone && <DownloadIcon />}
        {phone ? 'Export' : 'Export…'}
      </Chip>
    </header>
  );
}

/** Phone: secondary actions in a small menu. */
function PhoneMenu() {
  const setUi = useStore((s) => s.setUi);
  const undo = useStore((s) => s.undo);
  const canUndo = useStore((s) => s.history.past.length > 0);
  const [open, setOpen] = useState(false);
  const item = (label: string, run: () => void, disabled = false) => (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        setOpen(false);
        run();
      }}
    >
      {label}
    </button>
  );
  return (
    <div className="menu-wrap">
      <button
        type="button"
        className="ibtn"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <b aria-hidden="true">⋯</b>
      </button>
      {open && (
        <div className="menu" role="menu">
          {item('Undo', undo, !canUndo)}
          {item('Saved styles', () => setUi({ dialog: 'presets' }))}
          {item('Squad batch', () => setUi({ dialog: 'batch' }))}
          {item('Screenshot', () => void screenshot(useStore.getState().design))}
          {item('How to print and attach', () => setUi({ dialog: 'help' }))}
        </div>
      )}
    </div>
  );
}

type Toggle = keyof Pick<
  UiState,
  'showBase' | 'painted' | 'showFigure' | 'showRuler' | 'wireframe' | 'autoRotate'
>;
const TOGGLES: Array<[Toggle, string, string]> = [
  ['showBase', 'Base', 'Show the base'],
  ['painted', 'Painted', 'Text in a contrasting paint colour'],
  ['showFigure', '28mm figure', 'A generic 28 mm figure for scale'],
  ['showRuler', 'Ruler', 'Plate width and height'],
  ['wireframe', 'Wireframe', 'Show the mesh triangles'],
  ['autoRotate', 'Rotate', 'Slowly turn when idle'],
];

function ViewToggles({ only }: { only?: Toggle[] }) {
  const ui = useStore((s) => s.ui);
  const setUi = useStore((s) => s.setUi);
  return (
    <>
      {TOGGLES.filter(([k]) => !only || only.includes(k)).map(([k, label, title]) => (
        <Chip key={k} on={ui[k]} title={title} onClick={() => setUi({ [k]: !ui[k] })}>
          {label}
        </Chip>
      ))}
    </>
  );
}

const CAMERAS: Array<[CameraPreset, string]> = [
  ['front', 'Front'],
  ['side', 'Side'],
  ['top', 'Top'],
  ['iso', 'Iso'],
  ['fit', 'Fit'],
];

function CameraButtons({ only }: { only?: CameraPreset[] }) {
  const current = useStore((s) => s.ui.camera.preset);
  const request = useStore((s) => s.requestCamera);
  return (
    <>
      {CAMERAS.filter(([id]) => !only || only.includes(id)).map(([id, label]) => (
        <Chip
          key={id}
          on={current === id}
          onClick={() => request(id)}
          title={id === 'fit' ? 'Zoom to the plate' : undefined}
        >
          {label}
        </Chip>
      ))}
    </>
  );
}

function BuildingIndicator() {
  const status = useStore((s) => s.build.status);
  if (status !== 'building') return null;
  return (
    <div className="busy" aria-hidden="true">
      <span className="spinner" /> Forging…
    </div>
  );
}

function BaseSpec() {
  const base = useStore((s) => s.design.base);
  const r = resolveBase(base);
  const edge = base.edge === 'vertical' ? 'flat MDF edge' : 'sloped rim';
  const sz = (v: [number, number]) =>
    r.shape === 'round' || r.shape === 'square'
      ? `${+v[0].toFixed(2)}`
      : `${+v[0].toFixed(2)}×${+v[1].toFixed(2)}`;
  const name = r.shape === 'rect' ? 'Rectangle' : r.shape[0].toUpperCase() + r.shape.slice(1);
  return (
    <span>
      {name} {sz(r.bottom)} mm · {edge} · top {sz(r.top)} / bottom {sz(r.bottom)} /{' '}
      {+r.H.toFixed(2)} mm
    </span>
  );
}

function Toast() {
  const message = useToast((s) => s.message);
  if (!message) return null;
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}

export function DesktopLayout() {
  useUndoKeys();

  return (
    <div className="app">
      <TopBar phone={false} />
      <div className="workspace">
        <aside className="panel" aria-label="Design controls">
          <BaseSection />
          <TextSection />
          <StyleSection />
          <PlateSection />
          <AdvancedSection />
        </aside>
        <main className="stage">
          <div className="stage-bar">
            <div className="pill-group" role="group" aria-label="Camera">
              <CameraButtons />
            </div>
            <div className="spacer" />
            <div className="pill-group wrap" role="group" aria-label="View toggles">
              <ViewToggles />
              <Chip
                title="Save the view as a PNG"
                onClick={() => void screenshot(useStore.getState().design)}
              >
                PNG
              </Chip>
            </div>
          </div>
          <div className="canvas-wrap">
            <Viewport />
            <BuildingIndicator />
            <PrintCheck />
          </div>
          <footer className="stage-footer">
            <span className="hints">Drag to orbit · Right-drag to pan · Scroll to zoom</span>
            <div className="spacer" />
            <BaseSpec />
          </footer>
        </main>
      </div>
      <Dialogs />
      <Toast />
    </div>
  );
}

const TABS: Array<[MobileTab, string, () => React.JSX.Element]> = [
  ['base', 'Base', BaseTabIcon],
  ['text', 'Text', TextTabIcon],
  ['style', 'Style', StyleTabIcon],
  ['plate', 'Plate', PlateTabIcon],
];

export function PhoneLayout() {
  const tab = useStore((s) => s.ui.mobileTab);
  const setUi = useStore((s) => s.setUi);
  const summary = usePrintSummary();
  const [showCheck, setShowCheck] = useState(false);

  return (
    <div className="app phone">
      <TopBar phone />
      <div className="phone-stage">
        <Viewport />
        <BuildingIndicator />
        <div className="phone-cams" role="group" aria-label="Camera">
          <CameraButtons only={['front', 'iso', 'top', 'fit']} />
        </div>
        {summary && (
          <button
            type="button"
            className={`phone-status ${summary.ok ? 'ok' : 'warn'}`}
            aria-expanded={showCheck}
            onClick={() => setShowCheck((v) => !v)}
          >
            {summary.text}
          </button>
        )}
        <div className="phone-toggles" role="group" aria-label="View toggles">
          <ViewToggles only={['painted', 'showFigure']} />
        </div>
        {showCheck && <PrintCheck className="print-check phone-check" />}
      </div>
      <div className="sheet">
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-body" role="tabpanel" aria-label={tab}>
          {tab === 'base' && <BaseSection compact />}
          {tab === 'text' && <TextSection compact />}
          {tab === 'style' && <StyleSection compact />}
          {tab === 'plate' && (
            <>
              <PlateSection compact />
              <AdvancedSection />
            </>
          )}
        </div>
        <nav className="tabbar" aria-label="Editor sections" role="tablist">
          {TABS.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`tab${tab === id ? ' on' : ''}`}
              onClick={() => setUi({ mobileTab: id })}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
      </div>
      <Dialogs />
      <Toast />
    </div>
  );
}
