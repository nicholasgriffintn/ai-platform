import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { API_BASE_URL } from "~/constants";
import { listProjectConversationSources } from "~/lib/api/sources";
import type { AttachmentData } from "~/lib/chat/attachments";
import {
	createSourceAttachment,
	type SourceAttachmentCapabilities,
} from "~/lib/sources/attachments";

export function useProjectConversationSources(
	projectId: string,
	capabilities: SourceAttachmentCapabilities,
	options?: { enabled?: boolean },
) {
	const sourceDetails = useQuery({
		queryKey: ["sources", "project-conversation", projectId],
		queryFn: () => listProjectConversationSources(projectId),
		enabled: Boolean(projectId) && (options?.enabled ?? true),
		staleTime: 5 * 60 * 1000,
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
		error: sourceDetails.error,
		isLoading: sourceDetails.isLoading,
	};
}
