import { ResearchReport } from "@ngriffin_uk/polychat-component-experiences/content";
import type { ResearchStatus } from "@ngriffin_uk/polychat-schemas";

import { useResearchStatus } from "~/hooks/useResearchStatus";

const providerLabels: Record<string, string> = {
  parallel: "Parallel",
};

const FAILURE_STATUSES = new Set(["failed", "cancelled", "errored", "stopped"]);

type AsyncInvocationData = {
  provider?: string;
  id?: string;
  poll?: {
    url?: string;
    method?: string;
  };
  pollIntervalMs?: number;
  status?: string;
};

const normalizeStatus = (status?: string) => status?.toLowerCase() ?? "";

const ensureInterval = (value?: number | null, fallback = 5000) => {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;

  return Math.max(1000, numeric);
};

const buildInitialStatus = (base: any, provider: string): ResearchStatus | undefined => {
  if (!base?.run) {
    return undefined;
  }

  return {
    provider,
    run: base.run,
    output: base.output ?? undefined,
    warnings: base.warnings ?? undefined,
    poll: base.poll ?? undefined,
  };
};

export function ResearchView({ data, embedded }: { data: any; embedded: boolean }) {
  if (!data) {
    return <p className="text-red-500 dark:text-red-300">No research data available</p>;
  }

  const initialProvider = data.provider ?? data.raw?.provider ?? "parallel";
  const providerLabel = providerLabels[initialProvider] ?? initialProvider;
  const providerWarning = data.providerWarning ?? data.raw?.providerWarning;

  const asyncInvocation = (data.asyncInvocation ?? data.data?.asyncInvocation) as
    | AsyncInvocationData
    | undefined;

  const combinedInitial = {
    run: data.run ?? data.raw?.run ?? data.data?.run,
    output: data.output ?? data.raw?.output ?? data.data?.output,
    warnings: data.warnings ?? data.raw?.warnings ?? data.data?.warnings,
    poll: data.poll ?? data.raw?.poll ?? data.data?.poll,
  };

  const initialStatus = buildInitialStatus(combinedInitial, initialProvider);
  const initialRunId =
    initialStatus?.run?.run_id ?? asyncInvocation?.id ?? data.run_id ?? data.data?.run_id ?? null;

  const basePollInterval = ensureInterval(
    initialStatus?.poll?.interval_ms ??
      asyncInvocation?.pollIntervalMs ??
      data.options?.polling?.interval_ms ??
      data.poll?.interval_ms,
  );

  const initialStatusLabel = normalizeStatus(initialStatus?.run?.status);
  const isInitialFailure = FAILURE_STATUSES.has(initialStatusLabel);
  const isInitialCompleted = initialStatusLabel === "completed";
  const shouldPollInitially =
    Boolean(initialRunId) &&
    Boolean(initialStatus) &&
    (!initialStatus?.output || (!isInitialFailure && !isInitialCompleted));

  const researchQuery = useResearchStatus({
    runId: initialRunId ?? undefined,
    provider: initialProvider,
    enabled: shouldPollInitially,
    pollInterval: basePollInterval,
    initialData: initialStatus,
  });

  const statusData = researchQuery.data ?? initialStatus;

  const run = statusData?.run;
  const runId = run?.run_id ?? initialRunId;
  const output = statusData?.output;
  const warnings = statusData?.warnings;
  const normalizedStatus = normalizeStatus(run?.status ?? asyncInvocation?.status);
  const isFailure = FAILURE_STATUSES.has(normalizedStatus);
  const isInProgress = Boolean(runId) && !isFailure && normalizedStatus !== "completed";

  const lastUpdatedAt = researchQuery.dataUpdatedAt
    ? new Date(researchQuery.dataUpdatedAt)
    : run?.modified_at
      ? new Date(run.modified_at)
      : null;

  const queryError = researchQuery.error?.message;
  const runError = isFailure ? run?.error : undefined;
  const combinedError = queryError ?? runError ?? null;

  const shouldShowPollingNotice = isInProgress && !output;

  return (
    <ResearchReport
      providerLabel={providerLabel}
      providerWarning={providerWarning}
      run={run}
      output={output}
      warnings={warnings}
      normalizedStatus={normalizedStatus}
      lastUpdatedAt={lastUpdatedAt}
      errorMessage={combinedError}
      isPolling={shouldShowPollingNotice && !combinedError}
      embedded={embedded}
      runId={runId}
      onContinueConversation={
        data.completion_id
          ? () => window.open(`/?completion_id=${data.completion_id}`, "_blank")
          : undefined
      }
    />
  );
}
