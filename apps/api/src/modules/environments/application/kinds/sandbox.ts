import type { EnvironmentAction, UpdateSandboxRunControl } from "@ngriffin_uk/polychat-schemas";

import {
  getSandboxRunRecordForUser,
  requestSandboxRunControlAction,
} from "~/modules/sandbox/application/runs";

import type { EnvironmentKindDefinition } from "../../domain/environment-kind";

function toControlInput(action: EnvironmentAction): UpdateSandboxRunControl | null {
  switch (action.action) {
    case "pause":
    case "resume":
    case "cancel":
      return {
        action: action.action,
        reason: action.reason,
        expectedUpdatedAt: action.expected_updated_at,
      };
    case "extend_inspection":
      return {
        action: action.action,
        extensionSeconds: action.extension_seconds,
        expectedUpdatedAt: action.expected_updated_at,
      };
    default:
      return null;
  }
}

export const sandboxEnvironments: EnvironmentKindDefinition<"sandbox"> = {
  kind: "sandbox",
  actions: new Set(["pause", "resume", "cancel", "extend_inspection"]),
  async read({ context, user }, id) {
    const record = await getSandboxRunRecordForUser({ context, userId: user.id, runId: id });

    return {
      object: "environment",
      id,
      kind: "sandbox",
      detail: {
        run: record.run,
        createdByUserId: record.createdByUserId,
        projectId: record.projectId,
        conversationId: record.conversationId,
      },
    };
  },
  async act({ context, user }, id, action) {
    const input = toControlInput(action);

    return input
      ? requestSandboxRunControlAction({ context, userId: user.id, runId: id, input })
      : null;
  },
};
