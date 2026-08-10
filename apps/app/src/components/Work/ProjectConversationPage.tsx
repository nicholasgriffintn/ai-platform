import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { ConversationPage } from "~/components/ConversationThread/ConversationPage";
import { useIsLoading } from "~/state/contexts/LoadingContext";
import { projectQueryKey, useProject } from "~/hooks/useWorkspaces";
import { useChatStore } from "~/state/stores/chatStore";
import { WorkSidebar } from "./WorkSidebar";

export function ProjectConversationPage({
	workspaceId,
	projectId,
}: {
	workspaceId: string;
	projectId: string;
}) {
	const { data: project } = useProject(projectId);
	const queryClient = useQueryClient();
	const currentConversationId = useChatStore((state) => state.currentConversationId);
	const isStreamLoading = useIsLoading("stream-response");
	const refreshedConversationIdRef = useRef<string | null>(null);
	const capabilityIds = project?.capabilities.map((item) => item.capabilityId) ?? [];

	useEffect(() => {
		if (isStreamLoading) {
			refreshedConversationIdRef.current = null;
			return;
		}
		if (
			currentConversationId &&
			project &&
			refreshedConversationIdRef.current !== currentConversationId &&
			!project.conversations.some((conversation) => conversation.id === currentConversationId)
		) {
			refreshedConversationIdRef.current = currentConversationId;
			void queryClient.invalidateQueries({ queryKey: projectQueryKey(projectId) });
		}
	}, [currentConversationId, isStreamLoading, project, projectId, queryClient]);

	return (
		<ConversationPage
			title={project?.name ?? "Project conversation"}
			sidebarContent={<WorkSidebar workspaceId={workspaceId} projectId={projectId} />}
			modeConfig={{
				allowedAssistantActionCapabilityIds: capabilityIds,
				welcomeTitle: project?.name ?? "Project conversation",
				welcomeDescription:
					project?.description ||
					"This conversation uses the project's instructions and capabilities.",
				inputPlaceholder: {
					newConversation: "Message about this project…",
					followUp: "Reply…",
				},
				requestOptions: {
					metadata: { project_id: projectId },
				},
				analyticsSource: "project",
			}}
		/>
	);
}
