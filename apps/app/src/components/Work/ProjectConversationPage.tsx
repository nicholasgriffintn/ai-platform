import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { sandboxTaskTypeSchema, type SandboxTaskType } from "@assistant/schemas";

import { ConversationPage } from "~/components/ConversationThread/ConversationPage";
import { useIsLoading } from "~/state/contexts/LoadingContext";
import { projectQueryKey } from "~/hooks/useWorkspaces";
import { useChat } from "~/hooks/useChat";
import { getProjectLibraryPath } from "~/lib/project-experiences";
import { getProjectCodingPresentation } from "~/lib/project-coding-presentation";
import { useChatStore } from "~/state/stores/chatStore";
import { useWorkData } from "./WorkContext";
import { ProjectCodingTaskControl } from "./ProjectCodingTaskControl";

export function ProjectConversationPage({
	workspaceId,
	projectId,
}: {
	workspaceId: string;
	projectId: string;
}) {
	const { projectQuery } = useWorkData();
	const { data: project } = projectQuery;
	const queryClient = useQueryClient();
	const currentConversationId = useChatStore((state) => state.currentConversationId);
	const { data: currentConversation } = useChat(currentConversationId);
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
	const codingEnvironment = project?.codingEnvironment;
	const [draftTaskType, setDraftTaskType] = useState<SandboxTaskType>("feature-implementation");
	const [taskTypesByConversation, setTaskTypesByConversation] = useState<
		Record<string, SandboxTaskType>
	>({});
	const previousConversationIdRef = useRef<string | null>(null);
	const taskType = currentConversationId
		? (taskTypesByConversation[currentConversationId] ?? draftTaskType)
		: draftTaskType;
	const codingPresentation = getProjectCodingPresentation(taskType);
	const recipeManagementPath = getProjectLibraryPath(workspaceId, projectId);

	useEffect(() => {
		setDraftTaskType("feature-implementation");
		setTaskTypesByConversation({});
		previousConversationIdRef.current = null;
	}, [projectId]);

	useEffect(() => {
		if (!currentConversationId) {
			previousConversationIdRef.current = null;
			return;
		}

		if (previousConversationIdRef.current && !taskTypesByConversation[currentConversationId]) {
			setDraftTaskType("feature-implementation");
		}
		previousConversationIdRef.current = currentConversationId;
	}, [currentConversationId, taskTypesByConversation]);

	useEffect(() => {
		if (!currentConversationId) return;
		const persistedTaskType = [...(currentConversation?.messages ?? [])]
			.reverse()
			.map((message) => sandboxTaskTypeSchema.safeParse(message.data?.codingTaskType))
			.find((result) => result.success)?.data;
		if (!persistedTaskType) return;
		setTaskTypesByConversation((current) => ({
			...current,
			[currentConversationId]: persistedTaskType,
		}));
	}, [currentConversation, currentConversationId]);

	const handleTaskTypeChange = (nextTaskType: SandboxTaskType) => {
		if (currentConversationId) {
			setTaskTypesByConversation((current) => ({
				...current,
				[currentConversationId]: nextTaskType,
			}));
			return;
		}
		setDraftTaskType(nextTaskType);
	};

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
			embedded
			title={project?.name ?? "Project conversation"}
			modeConfig={{
				assistantActionRoutes: {
					recipes: recipeManagementPath,
				},
				assistantActionCatalog: {
					includeTools: false,
				},
				allowedAssistantActionCapabilities: capabilities,
				toolSelectionLocked: true,
				welcomeTitle: codingEnvironment
					? codingPresentation.title
					: (project?.name ?? "Project conversation"),
				welcomeDescription: codingEnvironment
					? codingPresentation.description
					: project?.description ||
						"This conversation uses the project's instructions and capabilities.",
				welcomeSampleQuestions: codingEnvironment ? codingPresentation.sampleQuestions : undefined,
				inputPlaceholder: {
					newConversation: codingEnvironment
						? codingPresentation.placeholder
						: "Message about this project…",
					followUp: codingEnvironment ? codingPresentation.placeholder : "Reply…",
				},
				inputControls: codingEnvironment ? (
					<ProjectCodingTaskControl taskType={taskType} onChange={handleTaskTypeChange} />
				) : undefined,
				requestOptions: {
					metadata: { project_id: projectId },
					...(codingEnvironment
						? {
								options: {
									sandbox: {
										enabled: true,
										installationId: codingEnvironment.installationId,
										repo: codingEnvironment.repository,
										taskType,
										promptStrategy: codingEnvironment.promptStrategy,
										shouldCommit: codingEnvironment.shouldCommit,
										timeoutSeconds: codingEnvironment.timeoutSeconds,
									},
								},
							}
						: {}),
				},
				analyticsSource: "project",
			}}
		/>
	);
}
