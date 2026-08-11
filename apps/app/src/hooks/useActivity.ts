import { useQuery } from "@tanstack/react-query";

import { listActivity } from "~/lib/api/activity";

export function useActivity(projectId?: string) {
	return useQuery({
		queryKey: ["activity", projectId],
		queryFn: () => listActivity({ projectId }),
	});
}
