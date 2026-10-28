import type { SystemModelLayers } from "@ngriffin_uk/polychat-ai-models";
import { systemModelChoicesSchema, type SystemModelChoices } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";
import type { IEnv, IUser } from "~/types";

export interface SystemModelScope {
  workspaceId?: string | null;
}

export async function loadSystemModelLayers(
  env: IEnv,
  user: IUser | undefined,
  scope: SystemModelScope = {},
): Promise<SystemModelLayers> {
  if (!env.DB) {
    return {};
  }

  const [userChoices, workspace] = await Promise.all([
    user?.id ? new UserSettingsRepository(env).getSystemModelChoices(user.id) : null,
    scope.workspaceId ? new WorkspaceRepository(env).getWorkspace(scope.workspaceId) : null,
  ]);

  return {
    user: userChoices?.choices,
    workspace: readWorkspaceSystemModelChoices(workspace?.system_models),
  };
}

export function readWorkspaceSystemModelChoices(
  stored: string | null | undefined,
): SystemModelChoices {
  const parsed = systemModelChoicesSchema.safeParse(stored ? safeParseJson(stored) : {});

  return parsed.success ? parsed.data : {};
}

export async function resolveConversationModelScope(
  env: IEnv,
  conversationId: string | undefined,
): Promise<SystemModelScope> {
  if (!conversationId || !env.DB) {
    return {};
  }

  return {
    workspaceId: await new WorkspaceRepository(env).findConversationWorkspaceId(conversationId),
  };
}
