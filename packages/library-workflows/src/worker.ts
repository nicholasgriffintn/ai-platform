import { createEventBus, type EventBus } from "./events.js";
import { runScheduledLoop, type ScheduleDefinition } from "./schedule.js";

export interface KpiDefinition {
  target: number;
  direction: "above" | "below";
  weight?: number;
}

export interface KpiReading {
  name: string;
  value: number;
  target: number;
  met: boolean;
  weight: number;
}

export interface WorkerEvaluation<TMetrics extends Record<string, number>> {
  metrics: TMetrics;
  readings: KpiReading[];
  score: number;
  unmet: KpiReading[];
}

export interface WorkerEvents<TMetrics extends Record<string, number>> extends Record<
  string,
  unknown
> {
  evaluated: WorkerEvaluation<TMetrics>;
  acted: { evaluation: WorkerEvaluation<TMetrics>; result: unknown };
  error: { error: unknown };
}

export interface WorkerDefinition<TMetrics extends Record<string, number>, TContext> {
  name: string;
  kpis: { [K in keyof TMetrics]: KpiDefinition };
  measure: (context: TContext) => Promise<TMetrics> | TMetrics;
  act?: (evaluation: WorkerEvaluation<TMetrics>, context: TContext) => Promise<unknown> | unknown;
  actWhen?: "always" | "unmet";
}

export interface Worker<TMetrics extends Record<string, number>, TContext> {
  readonly name: string;
  readonly events: EventBus<WorkerEvents<TMetrics>>;
  evaluate(context: TContext): Promise<WorkerEvaluation<TMetrics>>;
  tick(context: TContext): Promise<WorkerEvaluation<TMetrics>>;
  run(
    context: TContext,
    options: {
      schedule: ScheduleDefinition;
      signal?: AbortSignal;
      sleep?: (ms: number) => Promise<void>;
      now?: () => Date;
    },
  ): Promise<number>;
}

export function scoreKpis<TMetrics extends Record<string, number>>(
  kpis: { [K in keyof TMetrics]: KpiDefinition },
  metrics: TMetrics,
): WorkerEvaluation<TMetrics> {
  const readings: KpiReading[] = Object.entries(kpis).map(([name, kpi]) => {
    const value = metrics[name as keyof TMetrics];
    const met = kpi.direction === "above" ? value >= kpi.target : value <= kpi.target;

    return { name, value, target: kpi.target, met, weight: kpi.weight ?? 1 };
  });
  const totalWeight = readings.reduce((sum, reading) => sum + reading.weight, 0);
  const metWeight = readings
    .filter((reading) => reading.met)
    .reduce((sum, reading) => sum + reading.weight, 0);

  return {
    metrics,
    readings,
    score: totalWeight === 0 ? 1 : metWeight / totalWeight,
    unmet: readings.filter((reading) => !reading.met),
  };
}

export function createWorker<TMetrics extends Record<string, number>, TContext = void>(
  definition: WorkerDefinition<TMetrics, TContext>,
): Worker<TMetrics, TContext> {
  const events = createEventBus<WorkerEvents<TMetrics>>();
  const evaluate = async (context: TContext) => {
    const evaluation = scoreKpis(definition.kpis, await definition.measure(context));

    await events.emit("evaluated", evaluation);

    return evaluation;
  };

  const tick = async (context: TContext) => {
    const evaluation = await evaluate(context);
    const shouldAct =
      definition.act &&
      ((definition.actWhen ?? "unmet") === "always" || evaluation.unmet.length > 0);

    if (shouldAct && definition.act) {
      const result = await definition.act(evaluation, context);

      await events.emit("acted", { evaluation, result });
    }

    return evaluation;
  };

  return {
    name: definition.name,
    events,
    evaluate,
    tick,
    run: (context, options) =>
      runScheduledLoop({
        schedule: options.schedule,
        signal: options.signal,
        sleep: options.sleep,
        now: options.now,
        runImmediately: true,
        tick: async () => {
          await tick(context);
        },
        onError: (error) => events.emit("error", { error }),
      }),
  };
}
