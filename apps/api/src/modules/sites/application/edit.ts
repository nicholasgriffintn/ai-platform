import {
  applySitePatch,
  hasSiteErrors,
  validateSiteProject,
} from "@ngriffin_uk/polychat-library-sites";
import type { SiteEditRequest, SiteRecord } from "@ngriffin_uk/polychat-schemas";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { IUser } from "~/types";

import { getSite, updateSite } from "./records";

export interface EditSiteOptions {
  context: ServiceContext;
  user: IUser;
  siteId: string;
  request: SiteEditRequest;
}

export async function editSite({
  context,
  user,
  siteId,
  request,
}: EditSiteOptions): Promise<SiteRecord> {
  const scope = { context, userId: user.id, projectId: request.projectId };
  const existing = await getSite(scope, siteId);
  const document = structuredClone(existing.project) as unknown as Record<string, unknown>;

  for (const patch of request.patches) {
    try {
      applySitePatch(document, patch);
    } catch (error) {
      throw new AssistantError(
        `Edit could not be applied at ${patch.path}: ${getErrorMessage(error)}`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }

  const { project, issues } = validateSiteProject(document);

  if (hasSiteErrors(issues)) {
    throw new AssistantError(
      issues.find((issue) => issue.severity === "error")?.message ?? "The edit left the site empty",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return updateSite(scope, siteId, {
    brief: existing.brief,
    plan: existing.plan,
    project,
    issues,
    turn: {
      id: `edit-${generateId()}`,
      role: "edit",
      prompt: request.summary,
      createdAt: new Date().toISOString(),
    },
  });
}
