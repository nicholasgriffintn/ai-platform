export interface SparklineFrame {
  width: number;
  height: number;
  padding: number;
}

export function sparklinePoints(counts: readonly number[], frame: SparklineFrame): string {
  const { width, height, padding } = frame;
  const peak = Math.max(1, ...counts);
  const step = counts.length > 1 ? (width - padding * 2) / (counts.length - 1) : 0;

  return counts
    .map((count, index) => {
      const x = padding + index * step;
      const y = height - padding - (count / peak) * (height - padding * 2);

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
