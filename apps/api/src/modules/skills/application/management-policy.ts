import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  blockingSkillScanFindings,
  parseUserSkillDocument,
  scanSkillDocument,
  SkillDocumentError,
  type SkillScanInput,
} from "@ngriffin_uk/polychat-library-skills-catalogue";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { AuthoredSkillScope } from "~/modules/skills/infrastructure/AuthoredSkillRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { SKILL_CAPABILITY_KIND } from "./scope";

export const personalSkillScope = (userId: number): AuthoredSkillScope => ({
  type: "personal",
  id: userId,
});

export const projectSkillScope = (projectId: string): AuthoredSkillScope => ({
  type: "project",
  id: projectId,
});

const logger = getLogger({ prefix: "skills/scan" });

export function assertSkillPassesScan(
  document: SkillScanInput,
  stage: "promote" | "import",
  skillName: string,
): void {
  const findings = scanSkillDocument(document);
  const blocking = blockingSkillScanFindings(findings);
  const warnings = findings.filter((finding) => finding.severity === "warn");

  if (warnings.length > 0) {
    logger.warn(`Skill ${skillName} has scan warnings`, {
      stage,
      warnings: warnings.map((finding) => `${finding.location}: ${finding.message}`),
    });
  }

  if (blocking.length === 0) {
    return;
  }

  const verb = stage === "promote" ? "promoted" : "imported";

  throw new AssistantError(
    `Skill cannot be ${verb} until these are fixed: ${blocking
      .map((finding) => `${finding.location}: ${finding.message}`)
      .join("; ")}`,
    ErrorType.PARAMS_ERROR,
    400,
    { findings: blocking },
  );
}

export function parseAuthoredSkillDocument(content: string) {
  try {
    return parseUserSkillDocument(content);
  } catch (error) {
    if (error instanceof SkillDocumentError) {
      throw new AssistantError(error.message, ErrorType.PARAMS_ERROR, 400);
    }

    throw error;
  }
}

export async function getPublishedSkillCapability(
  context: ServiceContext,
  projectId: string,
  name: string,
) {
  return (
    await context.repositories.get(WorkspaceRepository).listProjectCapabilities(projectId)
  ).find(
    (capability) => capability.kind === SKILL_CAPABILITY_KIND && capability.capability_id === name,
  );
}

export async function requirePublishedProjectSkill(
  context: ServiceContext,
  projectId: string,
  skillId: string,
) {
  const capability = await getPublishedSkillCapability(context, projectId, skillId);

  if (!capability) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

  return capability;
}

export async function requireProjectSkillAdministration(
  context: ServiceContext,
  projectId: string,
  skillId: string,
): ReturnType<typeof requireProjectAccess> {
  const access = await requireProjectAccess(context, projectId, ["owner", "admin"]);

  await requirePublishedProjectSkill(context, projectId, skillId);

  return access;
}
