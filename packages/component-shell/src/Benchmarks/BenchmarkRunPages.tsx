import { PageStatus, Skeleton } from "@ngriffin_uk/polychat-component-ui";
import { useBenchmarkEntrant, useSharedBenchmarkRun } from "@ngriffin_uk/polychat-library-react";
import type { BenchmarkId, BenchmarkRunDetail } from "@ngriffin_uk/polychat-schemas";

import { RunDetailView } from "./RunDetailView.js";

function RunDetailState({
  data,
  isLoading,
  error,
  missingMessage,
}: {
  data: BenchmarkRunDetail | undefined;
  isLoading: boolean;
  error: Error | null;
  missingMessage: string;
}) {
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return <PageStatus title="Nothing to see here" message={missingMessage} />;
  }

  return <RunDetailView detail={data} />;
}

export function BenchmarkEntrantView({
  benchmarkId,
  modelId,
}: {
  benchmarkId: BenchmarkId;
  modelId: string;
}) {
  const query = useBenchmarkEntrant(benchmarkId, modelId);

  return (
    <RunDetailState
      data={query.data}
      isLoading={query.isLoading}
      error={query.error}
      missingMessage="This model has not run this benchmark yet."
    />
  );
}

export function SharedBenchmarkRunView({ token }: { token: string }) {
  const query = useSharedBenchmarkRun(token);

  return (
    <RunDetailState
      data={query.data}
      isLoading={query.isLoading}
      error={query.error}
      missingMessage="This shared run has been made private, deleted, or never existed."
    />
  );
}
