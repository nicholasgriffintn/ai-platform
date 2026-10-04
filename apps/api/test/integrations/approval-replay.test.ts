import type { D1Database } from "@cloudflare/workers-types";
import { NATIVE_MCP_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { replayApprovedConnectorOperation } from "~/modules/apps/application/connectors/approved-operation-replay";
import { handleToolCalls } from "~/modules/chat/application/tools/execution";
import { storeIntegrationConnection } from "~/modules/integrations/application/connections";

import { createNativeApprovalFixture } from "./approval-fixture";
import { initialiseIntegrationDatabase } from "./database";

vi.mock("~/modules/chat/application/tools/execution", () => ({ handleToolCalls: vi.fn() }));

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let database: D1Database;

beforeAll(async () => {
  database = await runtime.getD1Database("DB");
  await initialiseIntegrationDatabase(database);
});
beforeEach(async () => {
  vi.clearAllMocks();
  await database.batch([
    database.prepare("DELETE FROM integration_definition_revision"),
    database.prepare("DELETE FROM integration_definition"),
    database.prepare("DELETE FROM provider_connection"),
  ]);
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => runtime.dispose());

describe("native integration approval replay", () => {
  it("replays the exact native tool call and reuses a consumed result without executing again", async () => {
    const fixture = await createNativeApprovalFixture(database);

    vi.mocked(handleToolCalls).mockResolvedValue([fixture.terminal]);
    const request = {
      approval: fixture.approval,
      context: fixture.context,
      conversationManager: fixture.manager,
      user: fixture.user,
      model: "function-model",
    };
    const replay = await replayApprovedConnectorOperation(request);

    expect(replay.toolCall).toEqual(fixture.call);
    expect(replay.toolResult).toEqual(fixture.terminal);
    expect(handleToolCalls).toHaveBeenCalledOnce();
    expect(handleToolCalls).toHaveBeenCalledWith(
      fixture.approval.completionId,
      { response: "", tool_calls: [fixture.call] },
      fixture.manager,
      expect.objectContaining({
        request: expect.objectContaining({
          approved_tools: [NATIVE_MCP_TOOL_NAME],
          connector_approval_id: fixture.approval.id,
        }),
      }),
      { persistResults: "none", recoverUnknownToolCalls: false },
    );
    const consumed = await fixture.recordResult.mock.results[0]?.value;

    if (!consumed) {
      throw new Error("Missing recorded result");
    }

    fixture.getApproval.mockResolvedValue(consumed);
    await replayApprovedConnectorOperation({ ...request, approval: consumed });
    expect(handleToolCalls).toHaveBeenCalledOnce();
  });

  it("rejects altered stored arguments and reconnects before any tool execution", async () => {
    const fixture = await createNativeApprovalFixture(database);
    const request = {
      approval: fixture.approval,
      context: fixture.context,
      conversationManager: fixture.manager,
      user: fixture.user,
    };

    fixture.getMessages.mockResolvedValue([
      ...fixture.messages.slice(0, -1),
      {
        ...fixture.pending,
        tool_call_arguments: JSON.stringify({
          provider: fixture.definition.id,
          operation: "publish_report",
          params: { report: "Unreviewed report" },
        }),
      },
    ]);
    await expect(replayApprovedConnectorOperation(request)).rejects.toMatchObject({
      statusCode: 403,
    });
    fixture.getMessages.mockResolvedValue(fixture.messages);
    await storeIntegrationConnection({
      context: fixture.context,
      userId: 1,
      definitionId: fixture.definition.id,
      snapshot: fixture.snapshot,
      token: "replacement-replay-test-token",
    });
    await expect(replayApprovedConnectorOperation(request)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(handleToolCalls).not.toHaveBeenCalled();
  });

  it("records an expired consumed execution as unknown without retrying the native tool", async () => {
    const fixture = await createNativeApprovalFixture(database);
    const approval = {
      ...fixture.approval,
      state: "consumed",
      executionState: "running",
      executionLeaseExpiresAt: "2000-01-01T00:00:00.000Z",
    } satisfies typeof fixture.approval;

    fixture.getApproval.mockResolvedValue(approval);
    const replay = await replayApprovedConnectorOperation({
      approval,
      context: fixture.context,
      conversationManager: fixture.manager,
      user: fixture.user,
    });

    expect(replay.toolResult.name).toBe(NATIVE_MCP_TOOL_NAME);
    expect(replay.toolResult.data).toMatchObject({ outcome: "unknown", retryable: false });
    expect(fixture.recordIndeterminate).toHaveBeenCalledOnce();
    expect(handleToolCalls).not.toHaveBeenCalled();
  });
});
