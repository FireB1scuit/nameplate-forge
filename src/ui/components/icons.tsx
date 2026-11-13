/* Small inline icons (from the design canvas). All decorative: aria-hidden. */
const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  'aria-hidden': true,
} as const;

export const LogoMark = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
    <path d="M4 9h20l-2 10H6z" fill="none" stroke="#D4A853" strokeWidth="2" />
    <path d="M8 13h12" stroke="#D4A853" strokeWidth="2" />
  </svg>
);

export const UndoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...common}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h11a5 5 0 010 10h-3" />
  </svg>
);

export const RedoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...common}>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H9a5 5 0 000 10h3" />
  </svg>
);

export const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...common}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);

export const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...common} strokeWidth={2.2}>
    <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
  </svg>
);

export const BaseTabIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...common}>
    <ellipse cx="12" cy="9" rx="9" ry="4" />
    <path d="M3 9v4c0 2.2 4 4 9 4s9-1.8 9-4V9" />
  </svg>
);
export const TextTabIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...common}>
    <path d="M5 6V4h14v2M12 4v16M9 20h6" />
  </svg>
);
export const StyleTabIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...common}>
    <path d="M3 12l4-5h10l4 5-4 5H7z" />
  </svg>
);
export const PlateTabIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...common}>
    <path d="M4 12h16M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3" />
  </svg>
);

export const PlainThumb = () => (
  <svg width="60" height="18" viewBox="0 0 60 18" aria-hidden="true">
    <rect
      x="1"
      y="2"
      width="58"
      height="14"
      rx="4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path d="M14 9h32" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
  </svg>
);

export const RivetedThumb = () => (
  <svg width="60" height="18" viewBox="0 0 60 18" aria-hidden="true">
    <rect
      x="1"
      y="2"
      width="58"
      height="14"
      rx="1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="3.5"
      y="4.5"
      width="53"
      height="9"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.8"
    />
    <circle cx="7" cy="9" r="1.6" fill="currentColor" />
    <circle cx="53" cy="9" r="1.6" fill="currentColor" />
  </svg>
);
