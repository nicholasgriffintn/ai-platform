import {
  resolveToolDestination,
  resolveToolEffectClass,
  type ToolEffects,
} from "@ngriffin_uk/polychat-library-tools";
import {
  POLY_CONVERSATION_TYPE,
  type ConversationType,
  type TeammateAutonomyLevel,
  type TeammateStandingApproval,
  type ToolEffectClass,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

const RECORDED_MEMORY_TOOL_NAME = "memory";

type CallEffects = ToolEffects<Record<string, unknown>> | undefined;

function readToolCallArguments(rawArguments: unknown): Record<string, unknown> {
  const parsed = typeof rawArguments === "string" ? safeParseJson(rawArguments) : rawArguments;

  return isRecord(parsed) ? parsed : {};
}

export function resolveToolCallEffectClass(params: {
  toolName: string;
  effects: CallEffects;
  rawArguments: unknown;
}): ToolEffectClass {
  if (params.toolName === RECORDED_MEMORY_TOOL_NAME) {
    return "draft";
  }

  return resolveToolEffectClass(params.effects, readToolCallArguments(params.rawArguments));
}

export function resolveToolCallDestination(params: {
  effects: CallEffects;
  rawArguments: unknown;
}): string | undefined {
  return resolveToolDestination(params.effects, readToolCallArguments(params.rawArguments));
}

export function hasStandingApproval(params: {
  approvals: readonly TeammateStandingApproval[] | undefined;
  toolName: string;
  destination: string | undefined;
  now: number;
}): boolean {
  if (!params.destination) {
    return false;
  }

  return (params.approvals ?? []).some(
    (approval) =>
      approval.toolName === params.toolName &&
      approval.destination === params.destination &&
      Date.parse(approval.expiresAt) > params.now,
  );
}

export function isStandingApprovalEligible(params: {
  autonomyLevel: TeammateAutonomyLevel | null | undefined;
  conversationType: ConversationType | undefined;
  effectClass: ToolEffectClass;
  destination: string | undefined;
}): boolean {
  return (
    params.autonomyLevel === "assistant" &&
    params.conversationType === POLY_CONVERSATION_TYPE &&
    params.effectClass === "write" &&
    Boolean(params.destination)
  );
}
