import {
  bedrockManagedAgentTargetSchema,
  updateUserSettingsSchema,
} from "@ngriffin_uk/polychat-schemas";
import { encodeServerSentEvent } from "@ngriffin_uk/polychat-utility-core";
import { describe, expect, it, vi } from "vitest";

import { agentSessionTurnRecords } from "../agent-session-turn";

function sessionStream(...events: Record<string, unknown>[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encodeServerSentEvent(event));
      }

      controller.close();
    },
  });
}

async function collect(events: Record<string, unknown>[]) {
  const deleteSession = vi.fn(async () => undefined);
  const records = [];

  for await (const record of agentSessionTurnRecords(
    {
      harnessName: "Bedrock Managed Agents",
      start: async () => sessionStream(...events),
      deleteSession,
    },
    "op_1",
  )) {
    records.push(record.event);
  }

  return { records, deleteSession };
}

describe("agentSessionTurnRecords", () => {
  it("streams root turn text, ignores subagent completion and deletes the session", async () => {
    const { records, deleteSession } = await collect([
      { type: "agent.session.created", session: { id: "sess_1" } },
      { type: "agent.session.turn.output_text.delta", item_id: "item_1", delta: "Hello" },
      { type: "agent.session.turn.completed", turn: { subagent_id: "sub_1" } },
      { type: "agent.session.turn.completed", turn: { subagent_id: null } },
      { type: "agent.session.turn.output_text.delta", item_id: "item_1", delta: "late" },
    ]);

    expect(records).toEqual([
      { type: "text-delta", partId: "item_1", delta: "Hello" },
      { type: "operation-settled", operationId: "op_1", status: "done" },
    ]);
    expect(deleteSession).toHaveBeenCalledWith("sess_1");
  });

  it("settles unanswered when the stream ends before the turn does", async () => {
    const { records } = await collect([
      { type: "agent.session.created", session: { id: "sess_1" } },
    ]);

    expect(records).toEqual([
      {
        type: "operation-settled",
        operationId: "op_1",
        status: "unanswered",
        reason: "The Bedrock Managed Agents stream ended early",
      },
    ]);
  });
});

describe("bedrockManagedAgentTargetSchema", () => {
  const runtimeArn = "arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/polychat";

  it("takes the region from the Runtime ARN", () => {
    expect(
      bedrockManagedAgentTargetSchema.parse({
        runtimeArn,
        roleArn: "arn:aws:iam::123456789012:role/agents",
      }).region,
    ).toBe("us-west-2");
  });

  it("rejects a session role from another account", () => {
    expect(
      bedrockManagedAgentTargetSchema.safeParse({
        runtimeArn,
        roleArn: "arn:aws:iam::210987654321:role/agents",
      }).success,
    ).toBe(false);
  });

  it("reports a personal Runtime without a role on the role setting", () => {
    const result = updateUserSettingsSchema.safeParse({ bedrock_agent_runtime_arn: runtimeArn });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["bedrock_agent_role_arn"]]);
  });
});
