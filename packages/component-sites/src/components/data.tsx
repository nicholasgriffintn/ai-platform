import type { SiteComponentProps } from "@ngriffin_uk/polychat-library-sites";
import type { ReactNode } from "react";

import { cn } from "../class-names.js";
import { SiteIcon } from "../icons.js";
import { Action, HEADING_FONT } from "../ui.js";

const TRENDS = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-destructive",
  flat: "text-muted-foreground",
} as const;

export function Metric({
  label,
  value,
  change,
  trend = "flat",
  icon,
}: SiteComponentProps<"Metric">) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-5 text-card-foreground">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        <SiteIcon name={icon} size="sm" />
      </div>
      <span className={cn("text-3xl font-semibold tracking-tight", HEADING_FONT)}>{value}</span>
      {change && <span className={cn("text-xs font-medium", TRENDS[trend])}>{change}</span>}
    </div>
  );
}

export function Progress({ value, label, showValue }: SiteComponentProps<"Progress">) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="flex flex-col gap-2">
      {(label || showValue) && (
        <div className="flex items-center justify-between text-sm">
          <span>{label}</span>
          {showValue && <span className="text-muted-foreground">{Math.round(clamped)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

const CHART_HEIGHTS = { sm: 120, md: 200, lg: 300 } as const;
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function polar(cx: number, cy: number, r: number, angle: number) {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
}

export function Chart({ type, title, data, height = "md" }: SiteComponentProps<"Chart">) {
  const h = CHART_HEIGHTS[height];
  const w = 600;
  const max = Math.max(1, ...data.map((point) => point.value));
  const total = data.reduce((sum, point) => sum + point.value, 0) || 1;
  let body: ReactNode;

  if (type === "donut") {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) / 2 - 8;
    const starts = data.reduce<number[]>(
      (angles, point) => [
        ...angles,
        angles[angles.length - 1] + (point.value / total) * Math.PI * 2,
      ],
      [-Math.PI / 2],
    );
    const slices = data.map((point, index) => {
      const angle = starts[index];
      const sweep = (point.value / total) * Math.PI * 2;
      const [x1, y1] = polar(cx, cy, r, angle);
      const [x2, y2] = polar(cx, cy, r, angle + sweep);
      const large = sweep > Math.PI ? 1 : 0;
      const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${cx} ${cy} Z`;

      return (
        <path
          key={point.label}
          d={d}
          fill={CHART_COLORS[index % CHART_COLORS.length]}
          stroke="var(--card)"
          strokeWidth={2}
        />
      );
    });

    body = (
      <>
        {slices}
        <circle cx={cx} cy={cy} r={r * 0.55} fill="var(--card)" />
      </>
    );
  } else {
    const gap = 8;
    const slot = w / Math.max(1, data.length);
    const points = data.map((point, index) => {
      const x = slot * index + slot / 2;
      const y = h - 24 - (point.value / max) * (h - 40);

      return [x, y] as const;
    });
    const path = points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
    const first = points[0];
    const last = points[points.length - 1];

    body = (
      <>
        {type === "bar" &&
          points.map(([x, y], index) => (
            <rect
              key={data[index].label}
              x={x - slot / 2 + gap}
              y={y}
              width={Math.max(4, slot - gap * 2)}
              height={h - 24 - y}
              rx={4}
              fill="var(--chart-1)"
            />
          ))}
        {type === "area" && first && last && (
          <path
            d={`${path} L ${last[0]} ${h - 24} L ${first[0]} ${h - 24} Z`}
            fill="var(--chart-1)"
            opacity={0.2}
          />
        )}
        {(type === "line" || type === "area") && (
          <path d={path} fill="none" stroke="var(--chart-1)" strokeWidth={2.5} />
        )}
        {data.map((point, index) => (
          <text
            key={point.label}
            x={points[index][0]}
            y={h - 6}
            textAnchor="middle"
            fontSize={11}
            fill="var(--muted-foreground)"
          >
            {point.label}
          </text>
        ))}
      </>
    );
  }

  return (
    <figure className="flex flex-col gap-3 rounded-lg border bg-card p-5 text-card-foreground">
      {title && <figcaption className="text-sm font-medium">{title}</figcaption>}
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full"
        role="img"
        aria-label={title ?? `${type} chart`}
      >
        {body}
      </svg>
      {type === "donut" && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {data.map((point, index) => (
            <li key={point.label} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{
                  background: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
              {point.label}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

export function Table({ caption, columns, rows, striped }: SiteComponentProps<"Table">) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card text-card-foreground">
      <table className="w-full text-sm">
        {caption && (
          <caption className="px-4 py-3 text-left text-sm font-medium">{caption}</caption>
        )}
        <thead className="border-b bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-3 font-medium",
                  column.align === "end" ? "text-right" : "text-left",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${index}-${columns.map((column) => row[column.key] ?? "").join("|")}`}
              className={cn("border-b last:border-0", striped && index % 2 === 1 && "bg-muted/20")}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-4 py-3",
                    column.align === "end" ? "text-right tabular-nums" : "text-left",
                  )}
                >
                  {row[column.key] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KeyValue({ items }: SiteComponentProps<"KeyValue">) {
  return (
    <dl className="divide-y rounded-lg border bg-card text-sm text-card-foreground">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-6 px-4 py-3">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="text-right font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ title, description, action, icon }: SiteComponentProps<"EmptyState">) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      {icon && (
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <SiteIcon name={icon} size="sm" />
        </span>
      )}
      <span className="font-medium">{title}</span>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && (
        <Action href={action.href} size="sm">
          {action.label}
        </Action>
      )}
    </div>
  );
}
