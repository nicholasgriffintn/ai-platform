import {
  META_NAVIGATION_DATA_KEY,
  type MetaAssistantUiContext,
  type MetaNavigationTarget,
  metaNavigationTargetSchema,
} from "@ngriffin_uk/polychat-schemas";
import { matchPath } from "react-router";

import { createConversationLaunchPath } from "./assistant-action-launch.js";
import {
  getPersonalConversationPath,
  getProjectConversationPath,
  getProjectBasePath,
} from "./conversation-route.js";
import {
  getActivePlace,
  getPlacePaths,
  getProductMode,
  MODE_BASE_PATHS,
  PROFILE_PATH,
} from "./navigation/places.js";

const PROJECT_CONVERSATION_PATTERN = "/work/:workspaceId/projects/:projectId/chat/:conversationId?";
const PROJECT_PATTERN = "/work/:workspaceId/projects/:projectId/*";
const PROJECT_TASK_PATTERN = "/work/:workspaceId/projects/:projectId/tasks/:taskId";
const WORKSPACE_PATTERN = "/work/:workspaceId/*";
const PERSONAL_CONVERSATION_PATTERN = "/chat/:conversationId";

const RESERVED_CHAT_SEGMENTS = new Set(["attention", "files", "teammates", "apps", "tools"]);

export function buildMetaAssistantUiContext(
  pathname: string,
  fallbackConversationId?: string,
): MetaAssistantUiContext {
  const place = getActivePlace(pathname);
  const context: MetaAssistantUiContext = {
    route: pathname,
    mode: getProductMode(pathname),
    ...(place ? { place } : {}),
  };
  const projectConversation = matchPath(PROJECT_CONVERSATION_PATTERN, pathname);

  if (projectConversation?.params.workspaceId && projectConversation.params.projectId) {
    return {
      ...context,
      workspaceId: projectConversation.params.workspaceId,
      projectId: projectConversation.params.projectId,
      conversationId: projectConversation.params.conversationId ?? fallbackConversationId,
    };
  }

  const projectTask = matchPath(PROJECT_TASK_PATTERN, pathname);

  if (projectTask?.params.workspaceId && projectTask.params.projectId) {
    return {
      ...context,
      workspaceId: projectTask.params.workspaceId,
      projectId: projectTask.params.projectId,
      taskId: projectTask.params.taskId,
    };
  }

  const project = matchPath(PROJECT_PATTERN, pathname);

  if (project?.params.workspaceId && project.params.projectId) {
    return {
      ...context,
      workspaceId: project.params.workspaceId,
      projectId: project.params.projectId,
    };
  }

  const workspace = matchPath(WORKSPACE_PATTERN, pathname);

  if (workspace?.params.workspaceId && workspace.params.workspaceId !== "attention") {
    return { ...context, workspaceId: workspace.params.workspaceId };
  }

  const personalConversation = matchPath(PERSONAL_CONVERSATION_PATTERN, pathname);
  const personalConversationId = personalConversation?.params.conversationId;

  if (personalConversationId && !RESERVED_CHAT_SEGMENTS.has(personalConversationId)) {
    return { ...context, conversationId: personalConversationId };
  }

  if (pathname === "/" || pathname === MODE_BASE_PATHS.chat) {
    return { ...context, conversationId: fallbackConversationId };
  }

  return context;
}

export function getMetaNavigationHref(target: MetaNavigationTarget): string {
  switch (target.kind) {
    case "conversation": {
      const conversationPath =
        target.workspaceId && target.projectId
          ? getProjectConversationPath(target.workspaceId, target.projectId, target.conversationId)
          : getPersonalConversationPath(target.conversationId);

      return createConversationLaunchPath(conversationPath, {
        ...(target.openingMessage ? { query: target.openingMessage } : {}),
        ...(target.teammateId ? { teammateId: target.teammateId } : {}),
      });
    }

    case "project":
      return `/work/${encodeURIComponent(target.workspaceId)}/projects/${encodeURIComponent(target.projectId)}`;
    case "workspace":
      return `/work/${encodeURIComponent(target.workspaceId)}`;
    case "place":
      if (target.mode === "work" && (target.place === "files" || target.place === "teammates")) {
        return target.workspaceId && target.projectId
          ? `${getProjectBasePath(target.workspaceId, target.projectId)}/${target.place}`
          : MODE_BASE_PATHS.work;
      }

      return target.place === "you" ? PROFILE_PATH : getPlacePaths(target.mode)[target.place];
  }
}

export function readMetaNavigationTarget(data: unknown): MetaNavigationTarget | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const parsed = metaNavigationTargetSchema.safeParse(
    (data as Record<string, unknown>)[META_NAVIGATION_DATA_KEY],
  );

  return parsed.success ? parsed.data : null;
}
