import {
  resolveToolDestination,
  resolveToolEffectClass,
  resolveToolEffectClassWithHints,
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

import type { IRequest } from "~/types";

const RECORDED_MEMORY_TOOL_NAME = "memory";

type CallEffects = ToolEffects<Record<string, unknown>, IRequest> | undefined;

export interface ToolCallEffects {
  effectClass: ToolEffectClass;
  destination: string | undefined;
}

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

export async function resolveToolCallEffects(params: {
  toolName: string;
  effects: CallEffects;
  rawArguments: unknown;
  request: IRequest;
}): Promise<ToolCallEffects> {
  const input = readToolCallArguments(params.rawArguments);

  return {
    effectClass:
      params.toolName === RECORDED_MEMORY_TOOL_NAME
        ? "draft"
        : await resolveToolEffectClassWithHints(params.effects, input, params.request),
    destination: resolveToolDestination(params.effects, input),
  };
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
