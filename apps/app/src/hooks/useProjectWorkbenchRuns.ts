import {
  SANDBOX_RUNS_CAPABILITY_ID,
  sandboxRunDataSchema,
  type SandboxRunData,
} from "@ngriffin_uk/polychat-schemas";
import { useQuery } from "@tanstack/react-query";

import { listActivity } from "~/lib/api/activity";
import {
  fetchSandboxRunControl,
  fetchSandboxRunEvents,
  fetchSandboxRunInstructions,
} from "~/lib/api/sandbox";

const ACTIVE_REFRESH_MS = 2_000;
const IDLE_REFRESH_MS = 30_000;

export const projectWorkbenchRunsQueryKey = (projectId: string, conversationId?: string | null) =>
  ["project-workbench-runs", projectId, conversationId] as const;

function isActiveRun(run: SandboxRunData): boolean {
  return run.status === "queued" || run.status === "running" || run.status === "paused";
}

export function useProjectWorkbenchRuns({
  projectId,
  conversationId,
  conversationIsStreaming,
}: {
  projectId: string;
  conversationId?: string | null;
  conversationIsStreaming: boolean;
}) {
  const query = useQuery({
    queryKey: projectWorkbenchRunsQueryKey(projectId, conversationId),
    queryFn: async () => {
      const response = await listActivity({
        projectId,
        conversationId: conversationId ?? undefined,
        capabilityId: SANDBOX_RUNS_CAPABILITY_ID,
        limit: 100,
      });

      const runs = response.activities.flatMap((activity) => {
        const parsed = sandboxRunDataSchema.safeParse(activity.data);

        return parsed.success ? [{ activity, run: parsed.data }] : [];
      });
      const current = runs[0];

      if (!current) {
        return { runs, control: undefined, instructions: [], detailError: undefined };
      }

      const [eventsResult, controlResult, instructionsResult] = await Promise.allSettled([
        fetchSandboxRunEvents(current.run.runId),
        fetchSandboxRunControl(current.run.runId),
        fetchSandboxRunInstructions(current.run.runId),
      ]);
      const eventEnvelopes = eventsResult.status === "fulfilled" ? eventsResult.value : [];
      const control = controlResult.status === "fulfilled" ? controlResult.value : undefined;
      const instructions =
        instructionsResult.status === "fulfilled" ? instructionsResult.value : [];
      const detailError = [eventsResult, controlResult, instructionsResult].find(
        (result) => result.status === "rejected",
      );
      const events = eventEnvelopes.map(({ event }) => event);

      return {
        runs: [
          {
            ...current,
            run: {
              ...current.run,
              events: events.length > 0 ? events : current.run.events,
            },
          },
          ...runs.slice(1),
        ],
        control,
        instructions,
        detailError: detailError?.status === "rejected" ? detailError.reason : undefined,
      };
    },
    enabled: Boolean(projectId && conversationId),
    refetchInterval: (currentQuery) =>
      conversationIsStreaming || currentQuery.state.data?.runs.some(({ run }) => isActiveRun(run))
        ? ACTIVE_REFRESH_MS
        : IDLE_REFRESH_MS,
    refetchIntervalInBackground: true,
  });

  return {
    ...query,
    runs: query.data?.runs ?? [],
    currentRun: query.data?.runs[0]?.run,
    currentActivity: query.data?.runs[0]?.activity,
    currentControl: query.data?.control,
    currentInstructions: query.data?.instructions ?? [],
    detailError: query.data?.detailError,
  };
}
