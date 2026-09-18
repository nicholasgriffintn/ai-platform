import type {
  ApprovalHumanInTheLoop,
  HumanInTheLoopResolution,
  HumanInTheLoopStatus,
  HumanInTheLoopType,
  QuestionHumanInTheLoop,
  SelectionHumanInTheLoop,
  TakeoverHumanInTheLoop,
  UserQuestion,
  UserQuestionAnswer,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

export interface HumanInTheLoopPatch {
  type?: HumanInTheLoopType;
  status?: HumanInTheLoopStatus;
  requires_user_action?: boolean;
  interactionId?: string;
  toolName?: string;
  message?: string;
  options?: string[];
  questions?: UserQuestion[];
  answers?: UserQuestionAnswer[];
  resolution?: HumanInTheLoopResolution;
  resolvedAt?: string;
  consumedAt?: string;
}

export function pendingApproval(
  params: {
    interactionId?: string;
    toolName?: string;
    message?: string;
    options?: string[];
  } = {},
): ApprovalHumanInTheLoop {
  return {
    type: "approval",
    status: "pending",
    requires_user_action: true,
    ...(params.interactionId !== undefined ? { interactionId: params.interactionId } : {}),
    ...(params.toolName !== undefined ? { toolName: params.toolName } : {}),
    ...(params.message !== undefined ? { message: params.message } : {}),
    ...(params.options !== undefined ? { options: params.options } : {}),
  };
}

export function pendingQuestion(params: {
  interactionId: string;
  questions: UserQuestion[];
}): QuestionHumanInTheLoop {
  return {
    type: "question",
    status: "pending",
    requires_user_action: true,
    interactionId: params.interactionId,
    questions: params.questions,
  };
}

export function pendingSelection(): SelectionHumanInTheLoop {
  return {
    type: "selection",
    status: "pending",
    requires_user_action: true,
  };
}

export function pendingTakeover(params: {
  interactionId: string;
  toolName: string;
}): TakeoverHumanInTheLoop {
  return {
    type: "takeover",
    status: "pending",
    requires_user_action: true,
    interactionId: params.interactionId,
    toolName: params.toolName,
  };
}

export function mergeHumanInTheLoop(
  previous: unknown,
  patch: HumanInTheLoopPatch,
): Record<string, unknown> {
  const current = isRecord(previous) ? previous : {};

  return {
    ...current,
    ...(patch.type !== undefined ? { type: patch.type } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.requires_user_action !== undefined
      ? { requires_user_action: patch.requires_user_action }
      : {}),
    ...(patch.interactionId !== undefined ? { interactionId: patch.interactionId } : {}),
    ...(patch.toolName !== undefined ? { toolName: patch.toolName } : {}),
    ...(patch.message !== undefined ? { message: patch.message } : {}),
    ...(patch.options !== undefined ? { options: patch.options } : {}),
    ...(patch.questions !== undefined ? { questions: patch.questions } : {}),
    ...(patch.answers !== undefined ? { answers: patch.answers } : {}),
    ...(patch.resolution !== undefined ? { resolution: patch.resolution } : {}),
    ...(patch.resolvedAt !== undefined ? { resolvedAt: patch.resolvedAt } : {}),
    ...(patch.consumedAt !== undefined ? { consumedAt: patch.consumedAt } : {}),
  };
}

export function resolveHumanInTheLoop(previous: unknown): Record<string, unknown> {
  return mergeHumanInTheLoop(previous, {
    status: "resolved",
    requires_user_action: false,
  });
}

export function expireHumanInTheLoop(previous: unknown): Record<string, unknown> {
  return mergeHumanInTheLoop(previous, {
    status: "expired",
    requires_user_action: false,
  });
}
