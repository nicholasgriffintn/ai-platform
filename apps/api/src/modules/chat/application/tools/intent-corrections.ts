import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ToolApprovalDecisionTag } from "~/modules/chat/application/tools/approval";
import { DecisionFeedbackRepository } from "~/modules/decisions/infrastructure/DecisionFeedbackRepository";
import type { IEnv, IUser, Message } from "~/types";

const logger = getLogger({ prefix: "services/chat/tools/intent-corrections" });

const MAX_SUMMARY_CHARS = 500;

export type ToolIntentOutcome = "allow" | "require_approval";

function readMessageData(message: Message): Record<string, unknown> | null {
  if (typeof message.data === "string") {
    return safeParseJson<Record<string, unknown>>(message.data);
  }

  return message.data && typeof message.data === "object" && !Array.isArray(message.data)
    ? message.data
    : null;
}

function readDecisionTag(value: unknown): ToolApprovalDecisionTag | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.key === "string" &&
    typeof candidate.version === "string" &&
    typeof candidate.recommended === "string"
    ? { key: candidate.key, version: candidate.version, recommended: candidate.recommended }
    : null;
}

export function findEscalationDecision(
  messages: readonly Message[],
  toolCallId: string,
): ToolApprovalDecisionTag | null {
  for (const message of messages) {
    if (message.role !== "tool") {
      continue;
    }

    const data = readMessageData(message);
    const approval = data?.approval;

    if (typeof approval !== "object" || approval === null) {
      continue;
    }

    const record = approval as Record<string, unknown>;

    if (record.toolCallId !== toolCallId) {
      continue;
    }

    return readDecisionTag(record.decision);
  }

  return null;
}

export function correctionSummary(toolName: string, reason: unknown): string {
  const detail = typeof reason === "string" && reason.trim() ? ` — ${reason.trim()}` : "";

  return `${toolName}${detail}`.slice(0, MAX_SUMMARY_CHARS);
}

export async function recordToolIntentCorrection(params: {
  env: IEnv;
  user?: IUser;
  loadMessages: () => Promise<Message[]> | Message[];
  toolCallId: string;
  toolName: string;
  chosen: ToolIntentOutcome;
}): Promise<boolean> {
  if (!params.user?.id || !params.env.DB) {
    return false;
  }

  try {
    const decision = findEscalationDecision(await params.loadMessages(), params.toolCallId);

    if (!decision || decision.recommended === params.chosen) {
      return false;
    }

    await new DecisionFeedbackRepository(params.env).record({
      policyKey: decision.key,
      policyVersion: decision.version,
      userId: params.user.id,
      recommended: decision.recommended,
      corrected: params.chosen,
      summary: correctionSummary(
        params.toolName,
        params.chosen === "allow" ? "approved" : "rejected",
      ),
    });

    logger.info("Recorded a tool intent correction", {
      policyKey: decision.key,
      recommended: decision.recommended,
      corrected: params.chosen,
    });

    return true;
  } catch (error) {
    logger.warn("Failed to record a tool intent correction", { error });

    return false;
  }
}
