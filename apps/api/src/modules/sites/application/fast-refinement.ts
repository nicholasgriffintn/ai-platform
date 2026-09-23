import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  applySitePatch,
  hasSiteErrors,
  validateSiteProject,
} from "@ngriffin_uk/polychat-library-sites";
import type {
  SiteElementTarget,
  SitePlan,
  SiteRecord,
  SiteStreamEvent,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { IUser } from "~/types";

import type { ClassifiedSelectedElementRefinement } from "./plan";
import { updateSite } from "./records";

const logger = getLogger({ prefix: "services/sites/fast-refinement" });

export interface ApplySelectedElementFastRefinementOptions {
  context: ServiceContext;
  user: IUser;
  projectId?: string;
  existing: SiteRecord;
  plan: SitePlan;
  prompt: string;
  target: SiteElementTarget;
  completionId: string;
  refinement: ClassifiedSelectedElementRefinement;
  emit: (event: SiteStreamEvent) => void;
}

export async function applySelectedElementFastRefinement({
  context,
  user,
  projectId,
  existing,
  plan,
  prompt,
  target,
  completionId,
  refinement,
  emit,
}: ApplySelectedElementFastRefinementOptions): Promise<SiteRecord | null> {
  const action = refinement.action;

  if (!action) {
    return null;
  }

  let validated: ReturnType<typeof validateSiteProject>;

  try {
    const document = structuredClone(existing.project) as unknown as Record<string, unknown>;

    applySitePatch(document, action.patch);
    validated = validateSiteProject(document);
  } catch (error) {
    logger.warn("A Jev refinement patch could not be applied; using the coding model", {
      action_id: action.id,
      error_message: getErrorMessage(error),
    });

    return null;
  }

  if (hasSiteErrors(validated.issues)) {
    logger.warn("A Jev refinement patch failed validation; using the coding model", {
      action_id: action.id,
    });

    return null;
  }

  const { project, issues } = validated;

  emit({
    type: "intent",
    intent: "tweak",
    tier: "low",
    target,
    confidence: refinement.confidence,
  });
  emit({ type: "model", provider: refinement.provider, model: refinement.model });
  emit({ type: "patch", patch: action.patch });
  emit({ type: "phase", phase: "saving" });

  const site = await updateSite({ context, userId: user.id, projectId }, existing.id, {
    brief: existing.brief,
    plan,
    project,
    issues,
    quality: null,
    turn: {
      id: completionId,
      role: "user",
      prompt,
      createdAt: new Date().toISOString(),
      plan,
      intent: "tweak",
      target,
      provider: refinement.provider,
      model: refinement.model,
      trace: [refinement.trace],
    },
  });

  emit({ type: "saved", stage: "final", site });
  emit({ type: "done", issues, quality: null });

  return site;
}
