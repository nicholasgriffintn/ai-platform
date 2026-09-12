import {
  projectCodingEnvironmentSchema,
  resolveSandboxDeliveryPolicy,
  type ProjectCodingEnvironment,
} from "@ngriffin_uk/polychat-schemas";

import type { ProjectRow } from "~/repositories/WorkspaceRepository";
import { run_sandbox_task } from "~/services/functions/definitions/sandbox";
import { safeParseJson } from "~/utils/json";

export const PROJECT_CODING_TOOL_IDS = [run_sandbox_task.name];

export function resolveProjectCodingEnvironment(
  project: ProjectRow | null | undefined,
): ProjectCodingEnvironment | null {
  if (!project || project.coding_enabled !== 1) {
    return null;
  }

  const parsed = projectCodingEnvironmentSchema.safeParse({
    executionProvider: project.coding_execution_provider,
    installationId: project.coding_installation_id,
    repository: project.coding_repository,
    promptStrategy: project.coding_prompt_strategy,
    deliveryPolicy: resolveSandboxDeliveryPolicy(
      project.coding_delivery_policy ? safeParseJson(project.coding_delivery_policy) : null,
    ),
    environmentSetup: project.coding_environment_setup
      ? safeParseJson(project.coding_environment_setup)
      : undefined,
    timeoutSeconds: project.coding_timeout_seconds,
    inspectionWindowSeconds: project.coding_inspection_window_seconds,
  });

  return parsed.success ? parsed.data : null;
}
