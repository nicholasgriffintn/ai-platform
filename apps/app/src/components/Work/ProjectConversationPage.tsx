import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { ConversationPage } from "~/components/ConversationThread/ConversationPage";
import { useIsLoading } from "~/state/contexts/LoadingContext";
import { projectQueryKey, useProject } from "~/hooks/useWorkspaces";
import { getProjectLibraryPath } from "~/lib/project-experiences";
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
	const setChatMode = useChatStore((state) => state.setChatMode);
	const setSelectedAgentId = useChatStore((state) => state.setSelectedAgentId);
	const setSelectedAgentTokenPosition = useChatStore(
		(state) => state.setSelectedAgentTokenPosition,
	);
	const setSelectedAssistantAction = useChatStore((state) => state.setSelectedAssistantAction);
	const isStreamLoading = useIsLoading("stream-response");
	const refreshedConversationIdRef = useRef<string | null>(null);
	const capabilities =
		project?.capabilities.map(({ kind, capabilityId }) => ({ kind, capabilityId })) ?? [];
	const recipeManagementPath = getProjectLibraryPath(workspaceId, projectId);

	useEffect(() => {
		setChatMode("remote");
		setSelectedAgentId(null);
		setSelectedAgentTokenPosition(null);
		setSelectedAssistantAction(null);
	}, [setChatMode, setSelectedAgentId, setSelectedAgentTokenPosition, setSelectedAssistantAction]);

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
				assistantActionRoutes: {
					recipes: recipeManagementPath,
				},
				assistantActionCatalog: {
					includeTools: false,
				},
				allowedAssistantActionCapabilities: capabilities,
				toolSelectionLocked: true,
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
