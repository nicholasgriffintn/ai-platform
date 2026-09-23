import {
  applySitePatch,
  buildSiteImageRewritePatches,
  buildSiteSandboxTask,
  generateSiteFiles,
  validateSiteProject,
} from "@ngriffin_uk/polychat-library-sites";
import {
  sandboxDeliveryPolicyCreatesCommit,
  SITES_CAPABILITY_ID,
  type SiteBuildResponse,
  type SiteExportTarget,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getPrivateFileResourceFromUrl } from "~/infrastructure/storage/resource-urls";
import { executeSandboxRunStream } from "~/modules/apps/application/sandbox/execute-stream";
import {
  requireProjectAccess,
  requireProjectCapabilityAccess,
} from "~/modules/workspaces/application/access";
import { resolveProjectCodingEnvironment } from "~/modules/workspaces/application/projectCodingEnvironment";
import type { IUser } from "~/types";

import { getSite } from "./records";

export interface BuildSiteOptions {
  context: ServiceContext;
  user: IUser;
  siteId: string;
  projectId: string;
  instructions?: string;
  target: SiteExportTarget;
}

export async function buildSiteInSandbox({
  context,
  user,
  siteId,
  projectId,
  instructions,
  target,
}: BuildSiteOptions): Promise<SiteBuildResponse> {
  await requireProjectCapabilityAccess(context, projectId, "app", SITES_CAPABILITY_ID);

  const { project } = await requireProjectAccess(context, projectId);
  const codingEnvironment = resolveProjectCodingEnvironment(project);

  if (!codingEnvironment) {
    throw new AssistantError(
      "This project has no coding environment. Connect a repository in the project settings before building.",
      ErrorType.CONFIGURATION_ERROR,
      409,
    );
  }

  const site = await getSite({ context, userId: user.id, projectId }, siteId);
  const document = structuredClone(site.project) as unknown as Record<string, unknown>;

  for (const patch of buildSiteImageRewritePatches(site.project, (src) =>
    getPrivateFileResourceFromUrl(src, context.env.API_BASE_URL) ? "" : null,
  )) {
    applySitePatch(document, patch);
  }

  const { files } = generateSiteFiles(validateSiteProject(document).project, target);
  const task = buildSiteSandboxTask({
    project: site.project,
    brief: site.brief,
    files,
    instructions,
    target,
  });
  const response = await executeSandboxRunStream({
    env: context.env,
    context,
    user,
    projectId,
    payload: {
      executionProvider: codingEnvironment.executionProvider,
      installationId: codingEnvironment.installationId,
      repo: codingEnvironment.repository,
      task,
      taskType: "feature-implementation",
      promptStrategy: codingEnvironment.promptStrategy,
      deliveryPolicy: codingEnvironment.deliveryPolicy,
      shouldCommit: sandboxDeliveryPolicyCreatesCommit(codingEnvironment.deliveryPolicy),
      environmentSetup: codingEnvironment.environmentSetup,
      timeoutSeconds: codingEnvironment.timeoutSeconds,
    },
  });

  if (!response.ok) {
    const message = await response.text();

    throw new AssistantError(
      message.slice(0, 500) || "Failed to queue the sandbox run",
      ErrorType.UNKNOWN_ERROR,
    );
  }

  await response.body?.cancel().catch(() => {});

  const runId = response.headers.get("X-Sandbox-Run-Id")?.trim();

  if (!runId) {
    throw new AssistantError("The sandbox did not return a run id", ErrorType.UNKNOWN_ERROR);
  }

  return { runId, repo: codingEnvironment.repository };
}
