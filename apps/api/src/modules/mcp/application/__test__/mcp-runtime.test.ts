import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { describe, expect, it } from "vitest";

import { resolveConnectorOperationApproval } from "~/modules/apps/application/connectors/operation-approvals";
import { resolveMcpApprovalAuthority } from "~/modules/mcp/application/approved-action";
import { discoverMcpServer } from "~/modules/mcp/application/discovery";
import { updateMcpServer, disconnectMcpServer } from "~/modules/mcp/application/registry";
import { executeMcpTool } from "~/modules/mcp/application/tool-execution";

import { createMcpRuntimeFixture } from "../../../../../test/fixtures/mcp-runtime";

describe("native MCP execution boundaries", () => {
  it("requires exact write approval, executes it once and disables a changed schema", async () => {
    const fixture = await createMcpRuntimeFixture();
    const { owner, server, execution, state } = fixture;

    try {
      const enabled = await updateMcpServer(owner, server.id, {
        revision: server.revision,
        enabled: true,
        tools: server.tools.map((tool) => ({
          name: tool.name,
          schemaDigest: tool.schemaDigest,
          access: "write",
        })),
      });
      const call = {
        serverId: server.id,
        operation: enabled.tools[0].name,
        schemaDigest: enabled.tools[0].schemaDigest,
        params: { title: "Approved fixture issue" },
      };
      const pending = await executeMcpTool(call, execution);

      expect(pending.status).toBe("pending");
      expect(state.calls).toBe(0);
      if (
        !isRecord(pending.data) ||
        !("approvalId" in pending.data) ||
        typeof pending.data.approvalId !== "string"
      ) {
        throw new Error("Approval missing");
      }

      const approval = await owner.repositories.connectorOperationApprovals.getByIdForUser(
        pending.data.approvalId,
        owner.requireUser().id,
      );

      if (!approval) {
        throw new Error("Stored approval missing");
      }

      const run = await owner.repositories.conversationRuns.getById(owner.connectorRunId);

      if (!run) {
        throw new Error("Originating run missing");
      }

      await owner.repositories.conversationRuns.transition({
        runId: run.id,
        attempt: run.attempt,
        status: "awaiting_approval",
        interactionKind: "approval",
      });
      await resolveConnectorOperationApproval({
        context: owner,
        userId: owner.requireUser().id,
        approvalId: approval.id,
        resolution: "approved",
      });
      expect(
        (
          await resolveMcpApprovalAuthority({
            approval,
            call,
            context: owner,
            userId: owner.requireUser().id,
          })
        ).arguments,
      ).toEqual(call);
      owner.connectorApprovalExecutionToken = "fixture-execution-token";
      if (!execution.request.request) {
        throw new Error("Fixture request missing");
      }

      execution.request.request.connector_approval_id = approval.id;
      expect(
        (await executeMcpTool({ ...call, params: { title: "Unapproved mutation" } }, execution))
          .status,
      ).toBe("error");
      expect(state.calls).toBe(0);
      state.resultText = "Issue created synthetic-owner-token";
      const result = await executeMcpTool(call, execution);

      expect(result.status).toBe("success");
      expect(JSON.stringify(result)).not.toContain("synthetic-owner-token");
      expect(state.calls).toBe(1);
      expect((await executeMcpTool(call, execution)).status).toBe("error");
      expect(state.calls).toBe(1);
      state.tools[0] = { ...state.tools[0], description: "A changed server definition" };
      const refreshed = await discoverMcpServer(owner, server.id, enabled.revision);

      expect(refreshed.tools[0].access).toBe("disabled");
      expect((await executeMcpTool(call, execution)).status).toBe("error");
      expect(state.calls).toBe(1);
    } finally {
      fixture.fetchMock.mockRestore();
      await fixture.runtime.dispose();
    }
  }, 30_000);

  it("withholds results when the connection is revoked during the request", async () => {
    const fixture = await createMcpRuntimeFixture();
    const { owner, server, execution, state } = fixture;

    try {
      const enabled = await updateMcpServer(owner, server.id, {
        revision: server.revision,
        enabled: true,
        tools: server.tools.map((tool) => ({
          name: tool.name,
          schemaDigest: tool.schemaDigest,
          access: "read",
        })),
      });

      state.resultText = "Private fixture result";
      state.beforeResult = async () => {
        await disconnectMcpServer(owner, server.id);
      };

      const result = await executeMcpTool(
        {
          serverId: server.id,
          operation: enabled.tools[0].name,
          schemaDigest: enabled.tools[0].schemaDigest,
          params: { title: "Read fixture" },
        },
        execution,
      );

      expect(result.status).toBe("error");
      expect(JSON.stringify(result)).not.toContain("Private fixture result");
      expect(state.calls).toBe(1);
    } finally {
      fixture.fetchMock.mockRestore();
      await fixture.runtime.dispose();
    }
  }, 30_000);
});
