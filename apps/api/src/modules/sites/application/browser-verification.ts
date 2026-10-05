import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import {
  buildSiteBrowserRepairPrompt,
  buildSiteFrameDocument,
  buildSiteGoogleFontsUrl,
} from "@ngriffin_uk/polychat-library-sites";
import {
  siteBrowserCaptureResultSchema,
  type SiteBrowserEvidence,
  type SiteBrowserVerificationRequest,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, isPrivateHostname } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireActiveExecutionRun } from "~/modules/chat-runs/application/execution-authority";
import { createOutputProvenance } from "~/modules/outputs/application/provenance";

import { runSiteGeneration } from "./generate";
import { requireSiteIntegrationAccess } from "./integration-access";
import { readSiteData } from "./runtime";

export async function verifyAndRepairSite(
  context: ServiceContext,
  siteId: string,
  request: SiteBrowserVerificationRequest,
  signal?: AbortSignal,
): Promise<SiteBrowserEvidence> {
  const evidence = await verifySiteInBrowser(context, siteId, request, signal);

  if (!request.repair || evidence.status !== "failed") {
    return evidence;
  }

  await requireSiteIntegrationAccess(context, siteId, request, true);
  signal?.throwIfAborted();
  const result = await runSiteGeneration({
    context,
    user: context.requireUser(),
    request: {
      projectId: request.projectId,
      siteId,
      expectedRevision: request.expectedRevision,
      prompt: buildSiteBrowserRepairPrompt(evidence.checks),
    },
    signal,
  });

  signal?.throwIfAborted();
  const repaired = await verifySiteInBrowser(
    context,
    siteId,
    { ...request, expectedRevision: result.site.revision, repair: false },
    signal,
  );

  return { ...repaired, repairedFromRevision: request.expectedRevision };
}

export async function verifySiteInBrowser(
  context: ServiceContext,
  siteId: string,
  request: SiteBrowserVerificationRequest,
  signal?: AbortSignal,
): Promise<SiteBrowserEvidence> {
  if (!hasProEntitlement(context.requireUser())) {
    throw new AssistantError("Browser checks need a Pro account", ErrorType.FORBIDDEN, 403);
  }

  signal?.throwIfAborted();
  await requireActiveExecutionRun(context);
  const site = await requireSiteIntegrationAccess(context, siteId, request);
  const evidence: SiteBrowserEvidence = {
    id: `site-check-${generateId()}`,
    siteId,
    revision: site.revision,
    checkedAt: new Date().toISOString(),
    status: "unavailable",
    checks: [],
  };
  const origin = context.env.APP_BASE_URL ? new URL(context.env.APP_BASE_URL) : null;

  if (
    !context.env.COMPUTER_WORKER ||
    !origin ||
    origin.protocol !== "https:" ||
    isPrivateHostname(origin.hostname)
  ) {
    return evidence;
  }

  const pageId = request.pageId ?? Object.keys(site.project.pages)[0];
  const page = site.project.pages[pageId];

  if (!page) {
    throw new AssistantError("Site page not found", ErrorType.NOT_FOUND, 404);
  }

  const data = await readSiteData(context, siteId, request);
  const document = buildSiteFrameDocument({
    frameId: evidence.id,
    title: site.title,
    runtimeUrl: `${origin.origin}/sites-runtime/preview-runtime.js`,
    stylesheetUrl: `${origin.origin}/sites-runtime/styles.css`,
    fontUrl: buildSiteGoogleFontsUrl(site.project.theme.font),
  });

  for (const viewport of ["desktop", "mobile"] as const) {
    signal?.throwIfAborted();
    await requireActiveExecutionRun(context);
    try {
      const response = await context.env.COMPUTER_WORKER.fetch(
        "https://computer.internal/computer/site-verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resourceId: `site-probe-${generateId()}`,
            document,
            frameId: evidence.id,
            project: site.project,
            pageId,
            data: data.bindings,
            viewport,
            elementKeys: [page.root],
            allowedOrigins: [
              origin.origin,
              "https://fonts.googleapis.com",
              "https://fonts.gstatic.com",
            ],
          }),
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(90_000)])
            : AbortSignal.timeout(90_000),
        },
      );
      const parsed = response.ok
        ? siteBrowserCaptureResultSchema.safeParse(await response.json())
        : null;

      evidence.checks.push({
        pageId,
        viewport,
        status: parsed?.success ? parsed.data.status : "unavailable",
        diagnostics: parsed?.success ? redactSensitiveTokens(parsed.data.diagnostics) : [],
      });
    } catch {
      signal?.throwIfAborted();
      evidence.checks.push({ pageId, viewport, status: "unavailable", diagnostics: [] });
    }
  }

  await requireSiteIntegrationAccess(context, siteId, request);
  signal?.throwIfAborted();
  await requireActiveExecutionRun(context);
  evidence.status = evidence.checks.some((check) => check.status === "unavailable")
    ? "unavailable"
    : evidence.checks.some((check) => check.status === "failed")
      ? "failed"
      : "passed";
  await context.repositories.outputs.createOutput({
    createdByUserId: context.requireUser().id,
    projectId: site.projectId,
    capabilityId: "featured-sites",
    kind: "site_browser_evidence",
    groupId: siteId,
    title: `${site.title}: browser verification`,
    status: "ready",
    sensitivity: "confidential",
    content: evidence,
    provenance: createOutputProvenance({ origin: "generated", completeness: "complete" }),
  });

  return evidence;
}
