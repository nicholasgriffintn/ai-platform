import type { ChatRunTrigger, TeammateAutonomyLevel } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { runFunctionWithOutput } from "~/modules/outputs/application/run-with-output";
import type { IRequest } from "~/types";

import { getRunnableTool } from "./runnable";

export interface DirectToolRunAuthority {
  trigger: ChatRunTrigger;
  autonomyLevel: TeammateAutonomyLevel;
}

export interface DirectToolRunInput {
  context: ServiceContext;
  toolId: string;
  args: Record<string, unknown>;
  appUrl: string;
  platform: string;
  projectId?: string;
  authority?: DirectToolRunAuthority;
}

export function runToolDirectly({
  context,
  toolId,
  args,
  appUrl,
  platform,
  projectId,
  authority,
}: DirectToolRunInput) {
  if (!getRunnableTool(toolId)) {
    throw new AssistantError("Tool not found", ErrorType.NOT_FOUND, 404);
  }

  const request: IRequest = {
    app_url: appUrl,
    env: context.env,
    request: {
      completion_id: generateId(),
      input: "tool-execution",
      date: new Date().toISOString(),
      platform,
      ...(authority ? { trigger: authority.trigger, autonomy_level: authority.autonomyLevel } : {}),
    },
    user: context.requireUser(),
    context,
  };

  return runFunctionWithOutput(toolId, args, request, projectId);
}
