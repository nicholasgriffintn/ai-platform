import { useQuery } from "@tanstack/react-query";

import { apiService } from "~/lib/api/api-service";
import type { ResearchStatus } from "~/types/research";

const FAILURE_STATUSES = new Set(["failed", "cancelled", "errored", "stopped"]);

interface UseResearchStatusOptions {
	runId?: string;
	provider?: string;
	enabled?: boolean;
	pollInterval?: number;
	initialData?: ResearchStatus;
}

const researchStatusQueryKey = (runId?: string, provider?: string) => [
	"research-status",
	runId ?? "",
	provider ?? "",
];

const normalizeStatus = (status?: string) => status?.toLowerCase() ?? "";

export function useResearchStatus({
	runId,
	provider,
	enabled = true,
	pollInterval = 10000, // Increased default from 5s to 10s since backend polls proactively
	initialData,
}: UseResearchStatusOptions) {
	const sanitizedInterval = Math.max(5000, pollInterval || 0); // Minimum 5s instead of 1s

	return useQuery<ResearchStatus, Error>({
		queryKey: researchStatusQueryKey(runId, provider),
		queryFn: async () => {
			if (!runId) {
				throw new Error("Research run ID is required");
			}
			return apiService.fetchResearchStatus(runId, provider);
		},
		enabled: Boolean(runId) && enabled,
		initialData,
		refetchInterval: (query) => {
			if (!enabled) {
				return false;
			}

			const data = query.state.data as ResearchStatus | undefined;
			const intervalFromData = data?.poll?.interval_ms;
			// Backend now handles polling at 5s intervals, so we can be more relaxed
			const effectiveInterval = Math.max(
				5000,
				Number(intervalFromData ?? sanitizedInterval) || 0,
			);

			if (!data) {
				return effectiveInterval;
			}

			const status = normalizeStatus(data.run?.status);

			if (status === "completed") {
				return data.output ? false : effectiveInterval;
			}

			if (FAILURE_STATUSES.has(status)) {
				return false;
			}

			// Use exponential backoff for longer-running tasks
			const pollCount = (query.state.dataUpdateCount || 0) + 1;
			if (pollCount > 10) {
				// After 10 polls (~1.5 minutes), increase to 15s
				return Math.min(15000, effectiveInterval * 1.5);
			}

			return effectiveInterval;
		},
		retry: 3,
		staleTime: 0,
	});
}
