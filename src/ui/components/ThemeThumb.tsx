import { findFont } from '../../data/fonts';
import { getTheme, type StyleLayers, type ThemeId } from '../../data/themes';
import { outlineExtension, outlinePolygon } from '../../geometry/outline';

/**
 * Small flat drawing of a plate style, generated with the real outline code so the thumbnail
 * always matches what gets built.
 */
export function ThemeThumb({
  themeId,
  layers,
  label = 'NAME',
  width = 96,
}: {
  themeId: ThemeId;
  layers?: StyleLayers;
  label?: string;
  width?: number;
}) {
  const theme = getTheme(themeId);
  const l = layers ?? theme.layers;
  const h = 12;
  const core = 18;
  const poly = outlinePolygon(l.outline, { halfU: core, vBottom: -h / 2, vTop: h / 2, refV: 0 }, 2);
  const d = 'M' + poly.map(([u, v]) => `${u.toFixed(2)} ${(-v).toFixed(2)}`).join(' L') + ' Z';
  const ext = outlineExtension(l.outline, h);
  const half = core + ext + 1;
  const font = findFont(theme.fontId);
  const border = l.border.type !== 'none';
  const bw = 1;
  const ic = l.endCaps.icon;
  return (
    <svg
      width={width}
      height={(width * (h + 4)) / (2 * half)}
      viewBox={`${-half} ${-h / 2 - 2} ${2 * half} ${h + 4}`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={`clip-${themeId}-${l.outline}`}>
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} fill={theme.material.color} stroke="#0006" strokeWidth={0.4} />
      {border && (
        <path
          d={d}
          fill="none"
          stroke={theme.paint}
          strokeOpacity={0.75}
          strokeWidth={bw * (l.border.type === 'double' ? 2.6 : 1.2)}
          strokeDasharray={l.border.type === 'beaded' ? '0.1 2' : undefined}
          strokeLinecap="round"
          clipPath={`url(#clip-${themeId}-${l.outline})`}
          transform="scale(0.86 0.72)"
        />
      )}
      {ic !== 'none' &&
        [-1, 1].map((s) =>
          ic === 'rivet' ? (
            <circle
              key={s}
              cx={s * (core - 2.6)}
              cy={0}
              r={1.4}
              fill={theme.paint}
              opacity={0.85}
            />
          ) : (
            <image
              key={s}
              href={`${import.meta.env.BASE_URL}endcaps/${ic}.svg`}
              x={s * (core - 3.2) - 3}
              y={-3}
              width={6}
              height={6}
              transform={s > 0 ? `translate(${2 * s * (core - 3.2)} 0) scale(-1 1)` : undefined}
              style={{ filter: 'brightness(0.15)' }}
            />
          ),
        )}
      <text
        x={0}
        y={2.2}
        textAnchor="middle"
        fontSize={6.4}
        fill={theme.paint}
        style={{
          fontFamily: `'${font?.cssFamily ?? 'Cinzel'}', serif`,
          fontWeight: font?.cssWeight,
        }}
      >
        {label}
      </text>
    </svg>
  );
}
