import {
  DEFAULT_TEAMMATE_KIND,
  filterToolIdsForTeammateKind,
  findTeammateRole,
  resolveHiredTeammateBrief,
  type HireTeammateInput,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { createAgent } from "./agentCrud";

const DESCRIBED_ROLE_SUMMARY = "Hired from a job description.";

export async function hireTeammate(
  context: ServiceContext,
  params: HireTeammateInput,
  user?: IUser,
) {
  const role = params.role_slug ? findTeammateRole(params.role_slug) : undefined;

  if (params.role_slug && !role) {
    throw new AssistantError(
      `No built-in teammate role named "${params.role_slug}"`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const jobDescription = params.job_description?.trim() || undefined;
  const brief = resolveHiredTeammateBrief({ role, jobDescription });

  if (!brief) {
    throw new AssistantError("Choose a role or describe the job", ErrorType.PARAMS_ERROR, 400);
  }

  const name = params.name?.trim() || role?.title;

  if (!name) {
    throw new AssistantError("Give the teammate a name", ErrorType.PARAMS_ERROR, 400);
  }

  const kind = params.kind ?? role?.kind ?? DEFAULT_TEAMMATE_KIND;

  return createAgent(
    context,
    {
      name,
      kind,
      description: role?.summary ?? DESCRIBED_ROLE_SUMMARY,
      system_prompt: brief,
      enabled_tools: filterToolIdsForTeammateKind(kind, role?.suggestedTools) ?? [],
      mode: role?.mode ?? null,
      ...(params.workspace_id ? { workspace_id: params.workspace_id } : {}),
    },
    user,
  );
}
