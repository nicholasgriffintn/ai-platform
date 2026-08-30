import {
  getModelInteractionCapabilities,
  answerUserQuestionsSchema,
  type SandboxTaskType,
  sandboxTaskTypeSchema,
} from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { ConversationThreadModeConfig } from "~/components/ConversationThread";
import { ConversationPage } from "~/components/ConversationThread/ConversationPage";
import { CHATS_QUERY_KEY } from "~/constants";
import { useChat } from "~/hooks/useChat";
import { useModels } from "~/hooks/useModels";
import { useProjectConversationSources } from "~/hooks/useProjectConversationSources";
import { useProjectTask, useProjectTasks } from "~/hooks/useProjectTasks";
import { projectQueryKey } from "~/hooks/useWorkspaces";
import { getCapabilityLibraryPath, getProjectSurface } from "~/lib/capability-surfaces";
import { getErrorMessage } from "~/lib/errors";
import { getProjectCodingPresentation } from "~/lib/project-coding-presentation";
import { useChatStore } from "~/state/stores/chatStore";
import { useStreamActivityStore } from "~/state/stores/streamActivityStore";

import { ProjectCodingTaskControl } from "./ProjectCodingTaskControl";
import { useWorkData } from "./WorkDataContext";

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
  const { tasks, answer } = useProjectTasks(projectId);
  const pendingTask = tasks.find(
    (task) =>
      task.conversationId === currentConversationId &&
      task.status === "blocked" &&
      task.blockedReason === "awaiting_input",
  );
  const pendingTaskQuery = useProjectTask(projectId, pendingTask?.id ?? "");
  const isNewConversation = !currentConversationId;
  const projectSources = useProjectConversationSources(projectId, sourceCapabilities, {
    enabled: isNewConversation,
  });
  const setChatMode = useChatStore((state) => state.setChatMode);
  const setSelectedAgentId = useChatStore((state) => state.setSelectedAgentId);
  const setSelectedAgentTokenPosition = useChatStore(
    (state) => state.setSelectedAgentTokenPosition,
  );
  const setSelectedAssistantAction = useChatStore((state) => state.setSelectedAssistantAction);
  const isStreamLoading = useStreamActivityStore(
    (state) =>
      Boolean(currentConversationId) &&
      state.streams[currentConversationId as string]?.status === "streaming",
  );
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
  const recipeManagementPath = getCapabilityLibraryPath(getProjectSurface(workspaceId, projectId));
  const handleTaskQuestionInteraction = useCallback<
    NonNullable<ConversationThreadModeConfig["onToolInteraction"]>
  >(
    (toolName, action, data) => {
      if (toolName !== "ask_user" || action !== "submitPrompt" || !pendingTask) {
        return false;
      }

      const parsed = answerUserQuestionsSchema.safeParse(data);

      if (!parsed.success) {
        toast.error("The answers could not be read. Refresh the conversation and try again.");

        return true;
      }

      void (async () => {
        try {
          await answer.mutateAsync({ taskId: pendingTask.id, input: parsed.data });
          await queryClient.invalidateQueries({
            queryKey: [CHATS_QUERY_KEY, currentConversationId],
          });
          toast.success("Answers sent. The task is continuing.");
        } catch (mutationError) {
          toast.error(getErrorMessage(mutationError, "Unable to continue this task"));
        }
      })();

      return true;
    },
    [answer, currentConversationId, pendingTask, queryClient],
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

  return (
    <ConversationPage
      embedded
      title={project?.name ?? "Project conversation"}
      modeConfig={{
        contextAttachments: isNewConversation ? projectSources.attachments : [],
        contextAttachmentsReady: !isNewConversation || !projectSources.isLoading,
        assistantActionRoutes: {
          recipes: recipeManagementPath,
        },
        assistantActionCatalog: {
          includeAgents: false,
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
        hideComposerSuggestions: true,
        pendingUserQuestions: pendingTaskQuery.data?.pendingQuestions ?? null,
        onToolInteraction: handleTaskQuestionInteraction,
      }}
    />
  );
}
