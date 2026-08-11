import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { API_BASE_URL } from "~/constants";
import { useSources } from "~/hooks/useSources";
import { getSource } from "~/lib/api/sources";
import type { AttachmentData } from "~/lib/chat/attachments";
import {
	createSourceAttachment,
	type SourceAttachmentCapabilities,
} from "~/lib/sources/attachments";

interface AttachedSource {
	sourceId: string;
	attachment: AttachmentData;
}

export function useComposerSources({
	enabled,
	projectId,
	capabilities,
}: {
	enabled: boolean;
	projectId?: string;
	capabilities: SourceAttachmentCapabilities;
}) {
	const sourceFilters = projectId ? { projectId } : {};
	const { data: sources = [], isLoading } = useSources(sourceFilters, { enabled });
	const [attachedSources, setAttachedSources] = useState<AttachedSource[]>([]);
	const [attachingSourceId, setAttachingSourceId] = useState<string | null>(null);

	useEffect(() => {
		setAttachedSources([]);
		setAttachingSourceId(null);
	}, [projectId]);

	const attachedSourceIds = useMemo(
		() => attachedSources.map((source) => source.sourceId),
		[attachedSources],
	);
	const availableSources = useMemo(() => {
		const attachedIds = new Set(attachedSourceIds);
		return sources.filter((source) => source.status === "available" && !attachedIds.has(source.id));
	}, [attachedSourceIds, sources]);

	const attachSource = useCallback(
		async (sourceId: string): Promise<boolean> => {
			if (!sourceId || attachedSourceIds.includes(sourceId)) return false;

			setAttachingSourceId(sourceId);
			try {
				const source = await getSource(sourceId);
				const isInScope = projectId ? source.projectId === projectId : source.projectId === null;
				if (!isInScope || source.status !== "available") {
					toast.error(
						projectId
							? "This source is not available in the current project"
							: "This source is not available in personal Chat",
					);
					return false;
				}

				const contentUrl = `${API_BASE_URL}/sources/${encodeURIComponent(source.id)}/content`;
				const attachment = createSourceAttachment(source, contentUrl, capabilities);
				if (!attachment) {
					toast.error("The selected model cannot read this source");
					return false;
				}

				setAttachedSources((current) =>
					current.some((candidate) => candidate.sourceId === sourceId)
						? current
						: [...current, { sourceId, attachment }],
				);
				return true;
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Source could not be attached");
				return false;
			} finally {
				setAttachingSourceId(null);
			}
		},
		[attachedSourceIds, capabilities, projectId],
	);

	const removeAttachment = useCallback((indexToRemove: number) => {
		setAttachedSources((current) => current.filter((_, index) => index !== indexToRemove));
	}, []);
	const clearAttachments = useCallback(() => setAttachedSources([]), []);

	return {
		attachments: attachedSources.map((source) => source.attachment),
		attachingSourceId,
		attachSource,
		availableSources,
		clearAttachments,
		isLoading,
		removeAttachment,
	};
}
