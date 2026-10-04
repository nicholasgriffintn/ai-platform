import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import * as approvals from "~/modules/apps/application/connectors/operation-approvals";
import { storeIntegrationConnection } from "~/modules/integrations/application/connections";
import { runNativeIntegrationGateway } from "~/modules/integrations/application/gateway";
import type { ApiToolExecutionContext } from "~/types/functions";

import { createMcpTestServer } from "../../../../packages/ai-integrations/test/mcp-server";
import { createNativeApprovalFixture } from "./approval-fixture";
import { initialiseIntegrationDatabase } from "./database";

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
  await database.batch([
    database.prepare("DELETE FROM integration_definition_revision"),
    database.prepare("DELETE FROM integration_definition"),
    database.prepare("DELETE FROM provider_connection"),
  ]);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
afterAll(() => runtime.dispose());

describe("native integration function gateway", () => {
  it("withholds the upstream action until approval, then dispatches the exact reviewed arguments", async () => {
    const fixture = await createNativeApprovalFixture(database);
    const server = createMcpTestServer(fixture.snapshot.tools);

    vi.stubGlobal("fetch", server.fetch);
    const authorise = vi
      .spyOn(approvals, "authoriseConnectorOperation")
      .mockResolvedValueOnce({
        required: true,
        approved: false,
        approval: { ...fixture.approval, state: "pending" },
      })
      .mockResolvedValueOnce({
        required: true,
        approved: true,
        approval: fixture.approval,
        arguments: fixture.approval.arguments,
      });
    const execution: ApiToolExecutionContext = {
      completionId: fixture.approval.completionId,
      toolCallId: "native-call",
      env: fixture.context.env,
      user: fixture.user,
      request: {
        env: fixture.context.env,
        context: fixture.context,
        user: fixture.user,
        request: {
          completion_id: fixture.approval.completionId,
          input: "Publish the report",
          date: "2026-10-04",
        },
      },
    };
    const input = {
      provider: fixture.definition.id,
      operation: "publish_report",
      params: fixture.approval.arguments,
    };
    const pending = await runNativeIntegrationGateway(input, execution);

    expect(pending.status).toBe("pending");
    expect(server.state.requests).toEqual([]);
    execution.request.request = {
      ...execution.request.request,
      connector_approval_id: fixture.approval.id,
    };
    const result = await runNativeIntegrationGateway(input, execution);

    expect(result.status).toBe("success");
    expect(server.state.calls).toEqual([
      { name: "publish_report", arguments: fixture.approval.arguments },
    ]);
    expect(authorise).toHaveBeenLastCalledWith(
      expect.objectContaining({
        approvalId: fixture.approval.id,
        connectedAccountId: fixture.approval.connectedAccountId,
        arguments: fixture.approval.arguments,
      }),
    );
  });

  it("rejects an account replaced while service schemas are being checked before approval consumption or action dispatch", async () => {
    const fixture = await createNativeApprovalFixture(database);
    const server = createMcpTestServer(fixture.snapshot.tools);

    vi.stubGlobal("fetch", server.fetch);
    const authorise = vi.spyOn(approvals, "authoriseConnectorOperation");

    server.state.beforeList = async () => {
      await storeIntegrationConnection({
        context: fixture.context,
        userId: fixture.user.id,
        definitionId: fixture.definition.id,
        snapshot: fixture.snapshot,
        token: "rotated-test-token",
      });
    };

    const execution: ApiToolExecutionContext = {
      completionId: fixture.approval.completionId,
      toolCallId: "native-call",
      env: fixture.context.env,
      user: fixture.user,
      request: {
        env: fixture.context.env,
        context: fixture.context,
        user: fixture.user,
        request: {
          completion_id: fixture.approval.completionId,
          input: "Publish the report",
          date: "2026-10-04",
          connector_approval_id: fixture.approval.id,
        },
      },
    };
    const result = await runNativeIntegrationGateway(
      {
        provider: fixture.definition.id,
        operation: "publish_report",
        params: fixture.approval.arguments,
      },
      execution,
    );

    expect(result.status).toBe("error");
    expect(authorise).not.toHaveBeenCalled();
    expect(server.state.calls).toEqual([]);
  });
});
