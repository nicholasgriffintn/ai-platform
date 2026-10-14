import { authorise } from "@ngriffin_uk/polychat-library-policy";
import { siteEvaluationResponseSchema } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { evaluateSitePrompts } from "~/modules/sites/application/evaluate";

import type { JobKindDefinition } from "../../domain/job-kind";
import { requireScopedOutput } from "../outputs";
import { jobFields, readJobContent } from "../present";
import { publishJobChanged } from "../publish";

const SITE_EVALUATION_CAPABILITY = "site_evaluation";

export const siteEvaluationJobs: JobKindDefinition<"site_evaluation"> = {
  kind: "site_evaluation",
  outputCapability: SITE_EVALUATION_CAPABILITY,
  async start(scope, input) {
    if (!authorise("platform.admin", { role: scope.user.role ?? "", strict: false }).allowed) {
      throw new AssistantError("Admin access required", ErrorType.FORBIDDEN, 403);
    }

    const outputs = scope.context.repositories.outputs;
    const created = await outputs.createOutput({
      createdByUserId: scope.user.id,
      projectId: scope.projectId,
      capabilityId: SITE_EVALUATION_CAPABILITY,
      kind: SITE_EVALUATION_CAPABILITY,
      title: "Site prompt evaluation",
      status: "pending",
      content: { request: input },
    });

    scope.context.waitUntil(
      evaluateSitePrompts({ context: scope.context, user: scope.user, request: input })
        .then((summary) => ({ status: "ready" as const, content: { request: input, summary } }))
        .catch((error: unknown) => ({
          status: "failed" as const,
          content: { request: input, error: getErrorMessage(error, "The evaluation failed") },
        }))
        .then(async (settled) => {
          const updated = await outputs.updateOutput(created.id, {
            ...settled,
            expectedRevision: created.revision,
            updatedByUserId: scope.user.id,
          });
          const job = siteEvaluationJobs.present(updated);

          if (job) {
            publishJobChanged(scope.context, scope.user.id, job);
          }
        }),
    );

    const job = siteEvaluationJobs.present(await requireScopedOutput(scope, created.id));

    return { jobs: job ? [job] : [], rejected: [] };
  },
  present(record) {
    if (record.capability_id !== SITE_EVALUATION_CAPABILITY) {
      return null;
    }

    const content = readJobContent(record);
    const status =
      record.status === "ready"
        ? "succeeded"
        : record.status === "failed"
          ? "failed"
          : "in_progress";

    const summary = siteEvaluationResponseSchema.safeParse(content.summary);

    return {
      ...jobFields(record),
      kind: "site_evaluation",
      status,
      result: summary.success ? summary.data : null,
      error: typeof content.error === "string" ? content.error : null,
    };
  },
};
