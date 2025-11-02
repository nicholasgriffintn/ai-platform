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
	pollInterval = 5000,
	initialData,
}: UseResearchStatusOptions) {
	const sanitizedInterval = Math.max(1000, pollInterval || 0);

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
			const effectiveInterval = Math.max(
				1000,
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

			return effectiveInterval;
		},
		retry: 3,
		staleTime: 0,
	});
}
