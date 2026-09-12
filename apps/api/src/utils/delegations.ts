import {
  delegationSchema,
  delegationMemoryBindingSchema,
  type Delegation,
  type DelegationResult,
} from "@ngriffin_uk/polychat-schemas";

import type { DelegationRow } from "~/lib/database/schema";

import { safeParseJson } from "./json";

function parseResult(value: unknown): DelegationResult | null {
  if (!value) {
    return null;
  }

  const parsed = delegationSchema.shape.result.safeParse(
    typeof value === "string" ? safeParseJson<unknown>(value) : value,
  );

  return parsed.success ? parsed.data : null;
}

export function formatDelegation(row: DelegationRow): Delegation {
  const rawMemoryBindings =
    typeof row.memory_bindings_json === "string"
      ? safeParseJson<unknown>(row.memory_bindings_json)
      : row.memory_bindings_json;
  const memoryBindings = delegationMemoryBindingSchema.array().catch([]).parse(rawMemoryBindings);

  return delegationSchema.parse({
    id: row.id,
    parentConversationId: row.parent_conversation_id,
    childConversationId: row.child_conversation_id,
    parentRunId: row.parent_run_id,
    depth: row.depth,
    teammateId: row.teammate_id,
    goal: row.goal,
    waitFor: row.wait_for,
    budget: {
      maxCreditMicros: row.max_credit_micros,
      maxSteps: row.max_steps,
      deadline: row.deadline,
    },
    state: row.state,
    result: parseResult(row.result_json),
    memoryBindings,
    predecessorDelegationId: row.predecessor_delegation_id,
    continuationMode: row.continuation_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
