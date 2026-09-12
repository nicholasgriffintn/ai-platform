import type { ThreadModeConfig } from "@ngriffin_uk/polychat-component-conversation";
import type { ProjectWorkbenchHeaderSlots } from "@ngriffin_uk/polychat-component-workspaces";
import { useChatStore, useStreamActivityStore } from "@ngriffin_uk/polychat-library-client";
import {
  useChat,
  useConversationRoute,
  useModels,
  useProjectConversationSources,
  projectQueryKey,
  getCapabilityLibraryPath,
  getProjectSurface,
  getErrorMessage,
  getProjectCodingPresentation,
} from "@ngriffin_uk/polychat-library-react";
import {
  getModelInteractionCapabilities,
  type SandboxTaskType,
  sandboxTaskTypeSchema,
} from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ConversationPage } from "../Conversations/ConversationPage.js";
import { ConversationProductHeader } from "../Header/ConversationProductHeader.js";
import { ProjectCodingTaskControl } from "./ProjectCodingTaskControl.js";
import { ProjectFileAsTaskControl } from "./ProjectFileAsTaskControl.js";
import { ProjectWorkbenchConversation } from "./ProjectWorkbenchConversation.js";
import { useFileMessageAsTask } from "./useFileMessageAsTask.js";
import { useProjectTaskInteractions } from "./useProjectTaskInteractions.js";
import { useWorkData } from "./WorkDataContext.js";

export function ProjectConversationPage({
  workspaceId,
  projectId,
  conversationId,
}: {
  workspaceId: string;
  projectId: string;
  conversationId?: string;
}) {
  useConversationRoute({
    surface: { kind: "project", workspaceId, projectId },
    pathConversationId: conversationId,
  });
  const { projectQuery } = useWorkData();
  const { data: project } = projectQuery;
  const queryClient = useQueryClient();
  const currentConversationId = useChatStore((state) => state.currentConversationId);
  const fileAsTask = useFileMessageAsTask({ projectId, conversationId: currentConversationId });
  const model = useChatStore((state) => state.model);
  const { data: models } = useModels();
  const sourceCapabilities = useMemo(() => {
    const modelCapabilities = getModelInteractionCapabilities(model ? models?.[model] : undefined);

    return {
      supportsAudio: modelCapabilities.supportsAudio,
      supportsDocuments: modelCapabilities.supportsDocuments,
      supportsImages: modelCapabilities.isImageModel || modelCapabilities.isMultimodalModel,
    };
  }, [model, models]);
  const { data: currentConversation } = useChat(currentConversationId);
  const { conversationTask, pendingQuestions, onToolInteraction } = useProjectTaskInteractions(
    projectId,
    currentConversationId,
  );
  const isNewConversation = !currentConversationId;
  const projectSources = useProjectConversationSources(projectId, sourceCapabilities, {
    enabled: isNewConversation,
  });
  const setChatMode = useChatStore((state) => state.setChatMode);
  const setSelectedTeammateId = useChatStore((state) => state.setSelectedTeammateId);
  const setSelectedTeammateTokenPosition = useChatStore(
    (state) => state.setSelectedTeammateTokenPosition,
  );
  const setSelectedAssistantAction = useChatStore((state) => state.setSelectedAssistantAction);
  const isStreamLoading = useStreamActivityStore((state) =>
    currentConversationId ? state.streams[currentConversationId]?.status === "streaming" : false,
  );
  const refreshedConversationIdRef = useRef<string | null>(null);
  const projectCapabilities = project?.capabilities;
  const capabilities = useMemo(
    () => projectCapabilities?.map(({ kind, capabilityId }) => ({ kind, capabilityId })) ?? [],
    [projectCapabilities],
  );
  const codingEnvironment = project?.codingEnvironment;
  const [draftTaskType, setDraftTaskType] = useState<SandboxTaskType>("feature-implementation");
  const [taskTypesByConversation, setTaskTypesByConversation] = useState<
    Record<string, SandboxTaskType>
  >({});
  const previousConversationIdRef = useRef<string | null>(null);
  const taskType = currentConversationId
    ? (taskTypesByConversation[currentConversationId] ?? draftTaskType)
    : draftTaskType;
  const codingPresentation = useMemo(() => getProjectCodingPresentation(taskType), [taskType]);
  const recipeManagementPath = getCapabilityLibraryPath(getProjectSurface(workspaceId, projectId));
  const renderConversationHeader = useCallback(
    ({ status, actions }: ProjectWorkbenchHeaderSlots) => (
      <ConversationProductHeader
        additionalActions={actions}
        projectColour={project?.colour}
        requestOptions={{ metadata: { project_id: projectId } }}
        showProductModeSwitch={!conversationId}
        status={status}
      />
    ),
    [conversationId, project?.colour, projectId],
  );

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
    if (!currentConversationId) {
      return;
    }

    const persistedTaskType = [...(currentConversation?.messages ?? [])]
      .reverse()
      .map((message) => sandboxTaskTypeSchema.safeParse(message.data?.codingTaskType))
      .find((result) => result.success)?.data;

    if (!persistedTaskType) {
      return;
    }

    setTaskTypesByConversation((current) => ({
      ...current,
      [currentConversationId]: persistedTaskType,
    }));
  }, [currentConversation, currentConversationId]);

  const handleTaskTypeChange = useCallback(
    (nextTaskType: SandboxTaskType) => {
      if (currentConversationId) {
        setTaskTypesByConversation((current) => ({
          ...current,
          [currentConversationId]: nextTaskType,
        }));

        return;
      }

      setDraftTaskType(nextTaskType);
    },
    [currentConversationId],
  );

  useEffect(() => {
    setChatMode("chat");
    setSelectedTeammateId(null);
    setSelectedTeammateTokenPosition(null);
    setSelectedAssistantAction(null);
  }, [
    setChatMode,
    setSelectedTeammateId,
    setSelectedTeammateTokenPosition,
    setSelectedAssistantAction,
  ]);

  useEffect(() => {
    if (!projectSources.error) {
      return;
    }

    toast.error(
      getErrorMessage(projectSources.error, "Project sources could not be attached to this chat"),
      { id: `project-source-error-${projectId}` },
    );
  }, [projectId, projectSources.error]);

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

  const baseModeConfig = useMemo<ThreadModeConfig>(
    () => ({
      contextAttachments: isNewConversation ? projectSources.attachments : [],
      contextAttachmentsReady: !isNewConversation || !projectSources.isLoading,
      assistantActionRoutes: {
        recipes: recipeManagementPath,
      },
      assistantActionCatalog: {
        includeTeammates: false,
        includeTools: false,
        projectId,
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
      welcomeSuggestions: codingEnvironment ? codingPresentation.suggestions : undefined,
      welcomeCapabilitySuggestions: false,
      inputPlaceholder: {
        newConversation: codingEnvironment
          ? codingPresentation.placeholder
          : "Message about this project…",
        followUp: codingEnvironment ? codingPresentation.placeholder : "Reply…",
      },
      inputControls: codingEnvironment ? (
        <ProjectCodingTaskControl
          taskType={taskType}
          isDisabled={isStreamLoading}
          onChange={handleTaskTypeChange}
        />
      ) : (
        <ProjectFileAsTaskControl
          isEnabled={fileAsTask.isEnabled}
          isDisabled={isStreamLoading || fileAsTask.isFiling}
          onChange={fileAsTask.setIsEnabled}
        />
      ),
      ...(fileAsTask.isEnabled && !codingEnvironment ? { onFileAsTask: fileAsTask.file } : {}),
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
                  deliveryPolicy: codingEnvironment.deliveryPolicy,
                  environmentSetup: codingEnvironment.environmentSetup,
                  timeoutSeconds: codingEnvironment.timeoutSeconds,
                },
              },
            }
          : {}),
      },
      analyticsSource: "project",
      hideComposerSuggestions: true,
      pendingUserQuestions: pendingQuestions,
      onToolInteraction,
    }),
    [
      capabilities,
      codingEnvironment,
      codingPresentation,
      fileAsTask,
      handleTaskTypeChange,
      isNewConversation,
      isStreamLoading,
      onToolInteraction,
      pendingQuestions,
      project?.description,
      project?.name,
      projectId,
      projectSources.attachments,
      projectSources.isLoading,
      recipeManagementPath,
      taskType,
    ],
  );

  return (
    <ProjectWorkbenchConversation
      projectId={projectId}
      conversationId={currentConversationId}
      hasCodingEnvironment={Boolean(codingEnvironment)}
      conversationIsStreaming={isStreamLoading}
      conversationMessages={currentConversation?.messages}
      task={conversationTask}
      renderHeader={renderConversationHeader}
    >
      {({ runSteering, composerBanner }) => (
        <ConversationPage
          embedded
          header={null}
          pathConversationId={conversationId}
          title={project?.name ?? "Project conversation"}
          modeConfig={{ ...baseModeConfig, composerBanner, runSteering }}
        />
      )}
    </ProjectWorkbenchConversation>
  );
}
