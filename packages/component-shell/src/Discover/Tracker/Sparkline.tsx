import { cn } from "@ngriffin_uk/polychat-component-ui";
import { sparklinePoints } from "@ngriffin_uk/polychat-utility-core";

const SPARK_FRAME = { width: 96, height: 28, padding: 3 };

export function Sparkline({
  counts,
  label,
  colour = "var(--chart-1)",
  className,
}: {
  counts: readonly number[];
  label: string;
  colour?: string;
  className?: string;
}) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${SPARK_FRAME.width} ${SPARK_FRAME.height}`}
      preserveAspectRatio="none"
      className={cn("h-7 w-24 shrink-0", className)}
    >
      <title>{label}</title>
      <polyline
        points={sparklinePoints(counts, SPARK_FRAME)}
        fill="none"
        stroke={colour}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
