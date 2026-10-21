import {
  buildForecastRequest,
  buildForecastView,
  readForecastTable,
  type ForecastSelection,
  type ForecastTable,
} from "@ngriffin_uk/polychat-library-chat/forecast";
import { forecastService } from "@ngriffin_uk/polychat-library-client";
import type { TimeSeriesForecastView } from "@ngriffin_uk/polychat-schemas";
import { useCallback, useState } from "react";

import type { ForecastSample } from "./samples.js";

export type ColumnRole = "forecast" | "known" | "past" | "ignore";

const DEFAULT_HORIZON = 24;

function defaultSelection(table: ForecastTable, horizon: number): ForecastSelection {
  const numeric = table.columns.find((column) => column.kind === "numeric");

  return {
    targets: numeric ? [numeric.name] : [],
    timeColumn: table.columns.find((column) => column.kind === "time")?.name ?? null,
    horizon,
  };
}

function withRole(
  selection: ForecastSelection,
  column: string,
  role: ColumnRole,
): ForecastSelection {
  const without = (names: readonly string[] = []) => names.filter((name) => name !== column);

  return {
    ...selection,
    targets:
      role === "forecast" ? [...without(selection.targets), column] : without(selection.targets),
    knownCovariates:
      role === "known"
        ? [...without(selection.knownCovariates), column]
        : without(selection.knownCovariates),
    pastCovariates:
      role === "past"
        ? [...without(selection.pastCovariates), column]
        : without(selection.pastCovariates),
  };
}

export function roleOf(selection: ForecastSelection, column: string): ColumnRole {
  if (selection.targets.includes(column)) {
    return "forecast";
  }

  if (selection.knownCovariates?.includes(column)) {
    return "known";
  }

  return selection.pastCovariates?.includes(column) ? "past" : "ignore";
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "The forecast did not come back";
}

export function useForecastStudio(projectId?: string) {
  const [text, setText] = useState("");
  const [table, setTable] = useState<ForecastTable | null>(null);
  const [selection, setSelection] = useState<ForecastSelection>({
    targets: [],
    horizon: DEFAULT_HORIZON,
  });
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [view, setView] = useState<TimeSeriesForecastView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (nextText: string, nextSelection?: ForecastSelection) => {
      const nextTable = readForecastTable(nextText);

      setText(nextText);
      setTable(nextTable);
      setSelection(nextSelection ?? defaultSelection(nextTable, selection.horizon));
      setView(null);
      setError(null);
    },
    [selection.horizon],
  );

  const loadSample = useCallback(
    (sample: ForecastSample) => {
      setSampleId(sample.id);
      load(sample.csv, sample.selection);
    },
    [load],
  );

  const loadText = useCallback(
    (nextText: string) => {
      setSampleId(null);
      load(nextText);
    },
    [load],
  );

  const setRole = useCallback((column: string, role: ColumnRole) => {
    setSelection((current) => withRole(current, column, role));
  }, []);

  const setTimeColumn = useCallback((timeColumn: string | null) => {
    setSelection((current) => ({ ...current, timeColumn }));
  }, []);

  const setHorizon = useCallback((horizon: number) => {
    setSelection((current) => ({ ...current, horizon }));
  }, []);

  const run = useCallback(async () => {
    if (!table) {
      return;
    }

    const built = buildForecastRequest(table, selection);

    if (!built.ok) {
      setError(built.error);

      return;
    }

    setBusy(true);
    setError(null);

    try {
      setView(
        buildForecastView(built.request, await forecastService.forecast(built.request, projectId)),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }, [projectId, selection, table]);

  return {
    text,
    table,
    selection,
    sampleId,
    view,
    busy,
    error,
    loadSample,
    loadText,
    setRole,
    setTimeColumn,
    setHorizon,
    run,
  };
}
