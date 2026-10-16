import { authorise } from "@ngriffin_uk/polychat-library-policy";
import {
  toListPage,
  type Approval,
  type ListPage,
  type ProjectTaskAttentionItem,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  getConnectorOperationApproval,
  resolveConnectorOperationApproval,
  toConnectorOperationApprovalStatusView,
  type ConnectorOperationApprovalStatusView,
} from "~/modules/connectors/application/operation-approvals";
import { ConnectorOperationApprovalRepository } from "~/modules/connectors/infrastructure/ConnectorOperationApprovalRepository";
import { listProjectTaskAttention } from "~/modules/project-tasks/application/attention";

const PENDING_LIMIT = 100;

function presentConnectorApproval(view: ConnectorOperationApprovalStatusView): Approval {
  return {
    object: "approval",
    id: view.id,
    kind: "connector_operation",
    state: view.state,
    title: `${view.provider}: ${view.operation}`,
    detail: null,
    conversation_id: view.completionId,
    response_id: view.runId,
    project_id: null,
    provider: view.provider,
    operation: view.operation,
    created_at: view.createdAt,
    expires_at: view.expiresAt,
    resolved_at: view.resolvedAt,
    consumed_at: view.consumedAt,
    deep_link: null,
  };
}

function presentTaskAttention(item: ProjectTaskAttentionItem): Approval | null {
  if (!item.requiresAction || (item.kind !== "input" && item.kind !== "approval")) {
    return null;
  }

  return {
    object: "approval",
    id: item.id,
    kind: item.kind === "input" ? "task_input" : "task_approval",
    state: "pending",
    title: item.objective,
    detail: item.detail,
    conversation_id: item.conversationId,
    response_id: null,
    project_id: item.projectId,
    provider: null,
    operation: null,
    created_at: item.since,
    expires_at: null,
    resolved_at: null,
    consumed_at: null,
    deep_link: item.deepLink,
  };
}

async function listTaskApprovals(context: ServiceContext): Promise<Approval[]> {
  const user = context.requireUser();

  if (!authorise("work.access", { plan: user.plan_id ?? "" }).allowed) {
    return [];
  }

  const { data: items } = await listProjectTaskAttention(context, { limit: PENDING_LIMIT });

  return items.flatMap((item) => {
    const approval = presentTaskAttention(item);

    return approval ? [approval] : [];
  });
}

export async function listApprovals(
  context: ServiceContext,
  query: { limit: number; after?: string; kind?: Approval["kind"] },
): Promise<ListPage<Approval>> {
  const user = context.requireUser();
  const now = new Date().toISOString();
  const [connector, tasks] = await Promise.all([
    context.repositories
      .get(ConnectorOperationApprovalRepository)
      .listPendingForUser(user.id, now, PENDING_LIMIT),
    listTaskApprovals(context),
  ]);
  const approvals = [
    ...connector.map((record) =>
      presentConnectorApproval(toConnectorOperationApprovalStatusView(record, now)),
    ),
    ...tasks,
  ]
    .filter((approval) => !query.kind || approval.kind === query.kind)
    .sort(
      (left, right) =>
        right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id),
    );
  const start = query.after
    ? approvals.findIndex((approval) => approval.id === query.after) + 1
    : 0;

  return toListPage(
    approvals.slice(start, start + query.limit + 1),
    query.limit,
    (approval) => approval.id,
  );
}

export async function readApproval(context: ServiceContext, approvalId: string): Promise<Approval> {
  const user = context.requireUser();
  const connector = await context.repositories
    .get(ConnectorOperationApprovalRepository)
    .getByIdForUser(approvalId, user.id);

  if (connector) {
    return presentConnectorApproval(
      await getConnectorOperationApproval({ context, userId: user.id, approvalId }),
    );
  }

  const task = (await listTaskApprovals(context)).find((approval) => approval.id === approvalId);

  if (!task) {
    throw new AssistantError("Approval not found", ErrorType.NOT_FOUND, 404);
  }

  return task;
}

export async function resolveApproval(
  context: ServiceContext,
  approvalId: string,
  state: "approved" | "rejected",
): Promise<Approval> {
  const user = context.requireUser();
  const connector = await context.repositories
    .get(ConnectorOperationApprovalRepository)
    .getByIdForUser(approvalId, user.id);

  if (!connector) {
    throw new AssistantError(
      "Answer task questions and approvals through the response input",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await resolveConnectorOperationApproval({
    context,
    userId: user.id,
    approvalId,
    resolution: state,
  });

  return readApproval(context, approvalId);
}
