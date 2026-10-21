import { cn } from "@ngriffin_uk/polychat-component-ui";
import { timeSeriesForecastViewSchema } from "@ngriffin_uk/polychat-schemas";

import { ForecastChart } from "./ForecastChart";

interface ForecastViewProps {
  data: unknown;
  embedded: boolean;
}

export function ForecastView({ data, embedded }: ForecastViewProps) {
  const parsed = timeSeriesForecastViewSchema.safeParse(data);

  if (!parsed.success) {
    return null;
  }

  const view = parsed.data;

  return (
    <section
      aria-label="Time series forecast"
      className={cn(
        "w-full space-y-5 rounded-lg border border-border bg-surface-elevated p-4 text-foreground shadow-sm sm:p-5",
        embedded ? "max-w-full" : "max-w-2xl",
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">
          {view.horizon} {view.horizon === 1 ? "step" : "steps"} ahead
        </p>
        <p className="font-mono text-[11px] text-muted-foreground">{view.model}</p>
      </header>
      {view.series.map((series, index) => (
        <ForecastChart key={series.name} view={view} seriesIndex={index} />
      ))}
    </section>
  );
}
