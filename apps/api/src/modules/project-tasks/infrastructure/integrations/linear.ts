import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { closeComposioConnectorRun } from "~/modules/apps/application/connectors/composio-run";
import { executeRecipeConnectorOperation } from "~/modules/apps/application/connectors/operations";

import type { TaskIntegrationAdapter } from "./types";

const linearIssueSchema = z.object({
  id: z.string().min(1),
  identifier: z.string().min(1),
  title: z.string().max(1000),
  description: z.string().max(100000).nullish(),
  url: z.url(),
  updatedAt: z.string(),
});
const linearResultSchema = z.object({ data: z.object({ issue: linearIssueSchema.nullable() }) });

export const linearTaskIntegration: TaskIntegrationAdapter = {
  provider: "linear",
  async readIssue(context, projectId, locator) {
    try {
      const result = await executeRecipeConnectorOperation({
        context,
        userId: context.requireUser().id,
        request: {
          provider: "linear",
          operation: "LINEAR_GET_LINEAR_ISSUE",
          connectedAccountId: locator.accountId,
          params: { issue_id: locator.issueId },
        },
        scope: { completionId: context.connectorRunId, conversationId: null, projectId },
      });
      const parsed = linearResultSchema.safeParse(result);

      if (!parsed.success) {
        throw new AssistantError(
          "Linear returned an invalid issue",
          ErrorType.EXTERNAL_API_ERROR,
          502,
        );
      }

      const issue = parsed.data.data.issue;

      if (!issue) {
        throw new AssistantError("Linear issue is unavailable", ErrorType.NOT_FOUND, 404);
      }

      return {
        fields: {
          provider: "linear",
          accountId: locator.accountId,
          connectionId: null,
          externalId: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          description: issue.description ?? "",
          url: issue.url,
        },
        upstreamRevision: issue.updatedAt,
      };
    } finally {
      await closeComposioConnectorRun(context);
    }
  },
};
