export interface ScatterPoint {
  id: string;
  label: string;
  x: number;
  y: number;
  highlight?: boolean;
}

interface Axis {
  label: string;
  format: (value: number) => string;
  log?: boolean;
}

const WIDTH = 640;
const HEIGHT = 360;
const PADDING = { top: 20, right: 24, bottom: 48, left: 56 };
const TICKS = 4;
const MAX_LABELLED_POINTS = 12;

function extent(values: readonly number[], log: boolean): [number, number] {
  const transformed = values.map((value) => (log ? Math.log10(value) : value));
  const min = Math.min(...transformed);
  const max = Math.max(...transformed);
  const pad = max === min ? 1 : (max - min) * 0.08;

  return [min - pad, max + pad];
}

function scale(domain: [number, number], range: [number, number], log: boolean) {
  return (value: number) => {
    const input = log ? Math.log10(value) : value;
    const ratio = (input - domain[0]) / (domain[1] - domain[0]);

    return range[0] + ratio * (range[1] - range[0]);
  };
}

function ticks(domain: [number, number], log: boolean): number[] {
  return Array.from({ length: TICKS + 1 }, (_, index) => {
    const value = domain[0] + ((domain[1] - domain[0]) * index) / TICKS;

    return log ? 10 ** value : value;
  });
}

export function ScatterPlot({
  points,
  x,
  y,
  quadrants,
  ariaLabel,
}: {
  points: readonly ScatterPoint[];
  x: Axis;
  y: Axis;
  quadrants?: { topRight: string; bottomRight: string };
  ariaLabel: string;
}) {
  const usable = points.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y) && (!x.log || point.x > 0),
  );

  if (usable.length < 2) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        Not enough entrants yet to draw this. The board needs a few more runs.
      </p>
    );
  }

  const xDomain = extent(
    usable.map((point) => point.x),
    Boolean(x.log),
  );
  const yDomain = extent(
    usable.map((point) => point.y),
    false,
  );
  const toX = scale(xDomain, [PADDING.left, WIDTH - PADDING.right], Boolean(x.log));
  const toY = scale(yDomain, [HEIGHT - PADDING.bottom, PADDING.top], false);
  const midX = (PADDING.left + WIDTH - PADDING.right) / 2;
  const midY = (PADDING.top + HEIGHT - PADDING.bottom) / 2;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={ariaLabel}
        className="h-auto w-full min-w-[480px] text-muted-foreground"
      >
        {quadrants ? (
          <g className="fill-muted-foreground/60 font-mono text-[10px] uppercase">
            <text x={WIDTH - PADDING.right - 4} y={PADDING.top + 12} textAnchor="end">
              {quadrants.topRight}
            </text>
            <text x={WIDTH - PADDING.right - 4} y={HEIGHT - PADDING.bottom - 8} textAnchor="end">
              {quadrants.bottomRight}
            </text>
          </g>
        ) : null}
        <line
          x1={midX}
          x2={midX}
          y1={PADDING.top}
          y2={HEIGHT - PADDING.bottom}
          className="stroke-border"
          strokeDasharray="3 4"
        />
        <line
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={midY}
          y2={midY}
          className="stroke-border"
          strokeDasharray="3 4"
        />
        {ticks(xDomain, Boolean(x.log)).map((value) => (
          <text
            key={`x-${value}`}
            x={toX(value)}
            y={HEIGHT - PADDING.bottom + 18}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px] tabular-nums"
          >
            {x.format(value)}
          </text>
        ))}
        {ticks(yDomain, false).map((value) => (
          <text
            key={`y-${value}`}
            x={PADDING.left - 8}
            y={toY(value) + 3}
            textAnchor="end"
            className="fill-muted-foreground text-[10px] tabular-nums"
          >
            {y.format(value)}
          </text>
        ))}
        <text
          x={(PADDING.left + WIDTH - PADDING.right) / 2}
          y={HEIGHT - 8}
          textAnchor="middle"
          className="fill-foreground text-[11px]"
        >
          {x.label}
        </text>
        <text
          transform={`translate(14 ${midY}) rotate(-90)`}
          textAnchor="middle"
          className="fill-foreground text-[11px]"
        >
          {y.label}
        </text>
        {usable.map((point) => (
          <g key={point.id}>
            <circle
              cx={toX(point.x)}
              cy={toY(point.y)}
              r={point.highlight ? 6 : 4.5}
              className={
                point.highlight
                  ? "fill-accent-amber stroke-canvas"
                  : "fill-active-work/70 stroke-canvas"
              }
              strokeWidth={1.5}
            >
              <title>{point.label}</title>
            </circle>
            {usable.length <= MAX_LABELLED_POINTS || point.highlight ? (
              <text
                x={toX(point.x) + 8}
                y={toY(point.y) + 3}
                className="fill-foreground/80 text-[10px]"
              >
                {point.label}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}
