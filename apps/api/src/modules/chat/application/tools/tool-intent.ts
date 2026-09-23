import {
  defineDecisionPolicy,
  noul,
  type DecisionPolicyReceipt,
} from "@ngriffin_uk/polychat-ai-functions";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  decisionNoulConfidence,
  type DecisionEntry,
  type DecisionNoulAnswer,
  type ToolPermission,
} from "@ngriffin_uk/polychat-schemas";
import { truncateForModel } from "@ngriffin_uk/polychat-utility-core";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";

import { ai } from "~/infrastructure/ai";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "services/chat/tools/tool-intent" });

const TOOL_INTENT_MAX_REQUEST_CHARS = 12_000;
const TOOL_INTENT_MAX_EVIDENCE_STRING_CHARS = 1_000;
const TOOL_INTENT_MAX_ARGUMENT_ENTRIES = 32;
const TOOL_INTENT_MAX_ARGUMENT_DEPTH = 4;
const TRUNCATION_SUFFIX = "\n... (truncated)";
const SIDE_EFFECT_PERMISSIONS = new Set<ToolPermission>([
  "write",
  "sandbox",
  "orchestration",
  "delegate",
]);

const TOOL_INTENT_QUESTIONS = {
  matches_request: noul(
    "Does the proposed tool call directly fulfil, or form a necessary step toward fulfilling, the user's current request?",
    {
      true: "The user explicitly requested this effect, or it is a necessary and proportionate implementation step",
      false: "The call is unrelated, optional, speculative, or serves a different objective",
    },
  ),
  expands_scope: noul(
    "Does the proposed tool call materially expand the people, systems, data, resources, or consequences in scope beyond the user's current request?",
    {
      true: "The call reaches additional recipients, systems, data, resources, or consequences not requested",
      false:
        "The call remains within the people, systems, data, resources, and consequences requested",
    },
  ),
  needs_clarification: noul(
    "Could reasonable interpretations of the user's current request lead to materially different choices for this proposed tool call?",
    {
      true: "Material details are ambiguous or missing and guessing could create an unwanted effect",
      false: "The requested effect and its important scope are sufficiently clear",
    },
  ),
} as const;

const TOOL_INTENT_ALLOW_THRESHOLD = 0.85;
const TOOL_INTENT_RISK_THRESHOLD = 0.2;
const TOOL_INTENT_CONFIDENCE_THRESHOLD = 0.6;

function lowestSignalConfidence(answers: {
  matches_request: DecisionNoulAnswer;
  expands_scope: DecisionNoulAnswer;
  needs_clarification: DecisionNoulAnswer;
}): number {
  return Math.min(
    decisionNoulConfidence(answers.matches_request),
    decisionNoulConfidence(answers.expands_scope),
    decisionNoulConfidence(answers.needs_clarification),
  );
}

export const TOOL_INTENT_POLICY = defineDecisionPolicy({
  key: "tool-intent",
  version: "1",
  questions: TOOL_INTENT_QUESTIONS,
  evaluate: (answers) => {
    const confidence = lowestSignalConfidence(answers);

    if (confidence < TOOL_INTENT_CONFIDENCE_THRESHOLD) {
      return {
        outcome: "require_approval",
        confidence,
        reason: "The proposed action could not be matched to the request confidently",
      } as const;
    }

    if (answers.matches_request.noul < TOOL_INTENT_ALLOW_THRESHOLD) {
      return {
        outcome: "require_approval",
        confidence,
        reason: "The proposed action does not clearly follow from the request",
      } as const;
    }

    if (
      answers.expands_scope.noul > TOOL_INTENT_RISK_THRESHOLD ||
      answers.needs_clarification.noul > TOOL_INTENT_RISK_THRESHOLD
    ) {
      return {
        outcome: "require_approval",
        confidence,
        reason: "The proposed action may expand scope or needs clarification",
      } as const;
    }

    return {
      outcome: "allow",
      confidence,
      reason: "The proposed action matches the request without material scope expansion",
    } as const;
  },
});

export function requiresToolIntentVerification(params: {
  permissions: readonly ToolPermission[];
  alreadyApproved: boolean;
}): boolean {
  return (
    !params.alreadyApproved &&
    params.permissions.some((permission) => SIDE_EFFECT_PERMISSIONS.has(permission))
  );
}

function requestText(input: string | { prompt: string } | undefined): string {
  const text = typeof input === "string" ? input : input?.prompt;

  return truncateForModel(
    redactSensitiveTokens(text?.trim() || "No explicit current request was provided."),
    TOOL_INTENT_MAX_REQUEST_CHARS - TRUNCATION_SUFFIX.length,
  );
}

function projectArgumentValue(value: unknown, depth: number): DecisionEntry {
  if (depth >= TOOL_INTENT_MAX_ARGUMENT_DEPTH) {
    return "[truncated]";
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    return truncateForModel(
      value,
      TOOL_INTENT_MAX_EVIDENCE_STRING_CHARS - TRUNCATION_SUFFIX.length,
    );
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, TOOL_INTENT_MAX_ARGUMENT_ENTRIES)
      .map((entry) => projectArgumentValue(entry, depth + 1));
  }

  if (typeof value !== "object" || value === undefined) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, TOOL_INTENT_MAX_ARGUMENT_ENTRIES)
      .map(([key, entry]) => [key, projectArgumentValue(entry, depth + 1)]),
  );
}

export function projectToolIntentEvidence(evidence: unknown): DecisionEntry {
  return projectArgumentValue(redactSensitiveTokens(evidence), 0);
}

export async function verifyToolCallIntent(params: {
  env: IEnv;
  user?: IUser;
  completionId: string;
  conversationId?: string;
  request: string | { prompt: string } | undefined;
  toolName: string;
  permissions: readonly ToolPermission[];
  evidence: unknown;
}) {
  return ai.evaluateDecisionPolicy({
    env: params.env,
    user: params.user,
    completion_id: params.completionId,
    conversationId: params.conversationId,
    state: {
      user_request: requestText(params.request),
      proposed_tool_call: {
        name: params.toolName,
        permissions: [...params.permissions],
        evidence: projectToolIntentEvidence(params.evidence),
      },
    },
    policy: TOOL_INTENT_POLICY,
    fallback: "require_approval",
  });
}

export type ToolIntentGateResult =
  | {
      outcome: "allow";
      receipt: DecisionPolicyReceipt<"allow" | "require_approval">;
    }
  | {
      outcome: "require_approval";
      reason: string;
      receipt?: DecisionPolicyReceipt<"allow" | "require_approval">;
    };

export async function evaluateToolIntentGate(params: {
  env: IEnv;
  user?: IUser;
  completionId: string;
  conversationId?: string;
  request: string | { prompt: string } | undefined;
  toolName: string;
  permissions: readonly ToolPermission[];
  hasEvidenceProjector: boolean;
  evidence: unknown;
}): Promise<ToolIntentGateResult> {
  if (!params.hasEvidenceProjector) {
    return {
      outcome: "require_approval",
      reason: `Tool "${params.toolName}" needs confirmation because it has no privacy-safe intent evidence.`,
    };
  }

  const intent = await verifyToolCallIntent({
    env: params.env,
    user: params.user,
    completionId: params.completionId,
    conversationId: params.conversationId,
    request: params.request,
    toolName: params.toolName,
    permissions: params.permissions,
    evidence: params.evidence,
  });

  logger.info(`Tool "${params.toolName}" intent verification completed`, {
    policy: intent.receipt.policy,
    status: intent.receipt.status,
    applied: intent.receipt.applied,
    outcome: intent.outcome,
    recommendation: intent.receipt.recommendation?.outcome,
    confidence: intent.receipt.recommendation?.confidence,
    provider: intent.receipt.provider,
    model: intent.receipt.model,
  });

  if (intent.outcome === "require_approval") {
    const reason =
      intent.receipt.recommendation?.reason ??
      `Tool "${params.toolName}" needs confirmation because it may not match the request.`;

    logger.warn(`Tool "${params.toolName}" escalated by intent verification`, {
      policy: intent.receipt.policy,
      confidence: intent.receipt.recommendation?.confidence,
    });

    return { outcome: "require_approval", reason, receipt: intent.receipt };
  }

  return { outcome: "allow", receipt: intent.receipt };
}
