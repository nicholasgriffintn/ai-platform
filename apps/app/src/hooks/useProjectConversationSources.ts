import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { API_BASE_URL } from "~/constants";
import { getSource } from "~/lib/api/sources";
import type { AttachmentData } from "~/lib/chat/attachments";
import {
	createSourceAttachment,
	type SourceAttachmentCapabilities,
} from "~/lib/sources/attachments";
import { getProjectConversationSourceIds } from "~/lib/sources/project-context";
import { useProjectContextSources, useSources } from "./useSources";

export function useProjectConversationSources(
	projectId: string,
	capabilities: SourceAttachmentCapabilities,
) {
	const memories = useSources({ projectId, kind: "memory" });
	const context = useProjectContextSources(projectId);
	const sourceIds = useMemo(
		() => getProjectConversationSourceIds(memories.data ?? [], context.data ?? []),
		[context.data, memories.data],
	);
	const sourceDetails = useQuery({
		queryKey: ["sources", "project-conversation", projectId, sourceIds],
		queryFn: () => Promise.all(sourceIds.map((sourceId) => getSource(sourceId))),
		enabled: !memories.isLoading && !context.isLoading && sourceIds.length > 0,
	});
	const attachments = useMemo(
		() =>
			(sourceDetails.data ?? []).flatMap((source): AttachmentData[] => {
				const attachment = createSourceAttachment(
					source,
					`${API_BASE_URL}/sources/${encodeURIComponent(source.id)}/content`,
					capabilities,
				);
				return attachment ? [attachment] : [];
			}),
		[capabilities, sourceDetails.data],
	);

	return {
		attachments,
		contextSources: context.data ?? [],
		error: memories.error ?? context.error ?? sourceDetails.error,
		isLoading:
			memories.isLoading || context.isLoading || (sourceIds.length > 0 && sourceDetails.isLoading),
		memories: memories.data ?? [],
	};
}
