import type { TeammateResponse } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { requireWorkspaceAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

import { isWorkspaceTeammate, requireTeammateAccess } from "./access";
import { normaliseTeammateResponse } from "./teammateResponse";

export async function publishTeammateToWorkspace(
  context: ServiceContext,
  teammateId: string,
  workspaceId: string,
  userId?: number,
): Promise<TeammateResponse> {
  context.ensureDatabase();
  const id = userId ?? context.requireUser().id;

  await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  const source = normaliseTeammateResponse(
    await requireTeammateAccess(context, teammateId, "read", id),
  );

  if (isWorkspaceTeammate(source)) {
    throw new AssistantError(
      "That agent is already owned by a workspace",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const published = await context.repositories.agents.createTeammate({
    userId: id,
    ownerScopeType: "workspace",
    ownerScopeId: workspaceId,
    derivedFromTeammateId: source.id,
    name: source.name,
    description: source.description,
    avatarUrl: source.avatar_url,
    servers: source.servers,
    model: source.model,
    temperature: source.temperature,
    maxSteps: source.max_steps,
    systemPrompt: source.system_prompt,
    fewShotExamples: source.few_shot_examples,
    enabledTools: source.enabled_tools,
    skillIds: source.skill_ids,
    mode: source.mode,
  });

  return normaliseTeammateResponse(published);
}
