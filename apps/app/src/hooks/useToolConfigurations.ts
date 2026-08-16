import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ModelToolId, SavedToolConfigurationsResponse } from "@ngriffin_uk/polychat-schemas";

import { fetchToolConfigurations, saveToolConfiguration } from "~/lib/api/tool-configurations";
import type { ModelToolConfiguration } from "~/lib/model-tool-configuration";

export const TOOL_CONFIGURATIONS_QUERY_KEY = ["toolConfigurations"];

export function useToolConfigurations() {
	const queryClient = useQueryClient();
	const query = useQuery({
		queryKey: TOOL_CONFIGURATIONS_QUERY_KEY,
		queryFn: fetchToolConfigurations,
	});
	const save = useMutation({
		mutationFn: ({
			toolId,
			configuration,
		}: {
			toolId: ModelToolId;
			configuration: ModelToolConfiguration;
		}) => saveToolConfiguration(toolId, { configuration }),
		onSuccess: (saved) => {
			queryClient.setQueryData<SavedToolConfigurationsResponse>(
				TOOL_CONFIGURATIONS_QUERY_KEY,
				(current) => {
					const configurations = (current?.configurations ?? []).filter(
						(configuration) => configuration.toolId !== saved.toolId,
					);
					return { configurations: [...configurations, saved] };
				},
			);
		},
	});

	return { query, save };
}
