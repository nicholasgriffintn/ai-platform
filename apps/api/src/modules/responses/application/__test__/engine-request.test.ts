import { PermissionChecker } from "@ngriffin_uk/polychat-library-tools";
import type { TeammateRunConfiguration } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { toEngineRequest } from "../engine-request";

const configuration: TeammateRunConfiguration = {
  teammateId: "teammate-123",
  behaviour: "colleague",
  persona: { name: "Researcher", instructions: "Answer carefully." },
  model: "mistral-large-latest",
  mode: "teammate",
  skillIds: [],
  enabledTools: ["run_council"],
  memoryBindings: [],
  mcpServers: [],
  connectionGrants: [],
  maxSteps: 20,
  usedSteps: 0,
};

describe("toEngineRequest", () => {
  it("refuses server-only fields smuggled into the command settings", () => {
    for (const settings of [
      { trigger: "schedule" },
      { resolved_configuration: configuration },
      { command_payload: { stageId: "stage-1" } },
      { require_approval_for: [] },
    ]) {
      expect(() =>
        toEngineRequest({
          messages: [{ role: "user", content: "Hello" }],
          settings: settings as never,
        }),
      ).toThrow();
    }
  });

  it("starts a run from the command envelope and the trusted authority", () => {
    const request = toEngineRequest(
      {
        conversationId: "conversation-1",
        conversationType: "task",
        commandId: "dispatch-1",
        runId: "run-1",
        messages: [{ role: "user", content: "Do the task" }],
        stream: false,
        store: true,
        settings: { mode: "agent", stop: "END", reasoning: { effort: "low" } },
      },
      {
        trigger: "schedule",
        durableExecution: { kind: "delegation", maxCreditMicros: 500 },
        commandPayload: { stageId: "stage-1" },
        requireApprovalFor: ["write"],
        enforceModeToolPolicy: true,
      },
    );

    expect(request).toMatchObject({
      completion_id: "conversation-1",
      conversation_type: "task",
      command_id: "dispatch-1",
      run_id: "run-1",
      stream: false,
      store: true,
      mode: "agent",
      stop: ["END"],
      reasoning_effort: "low",
      trigger: "schedule",
      durable_execution: { kind: "delegation", maxCreditMicros: 500 },
      command_payload: { stageId: "stage-1" },
      require_approval_for: ["write"],
      enforce_mode_tool_policy: true,
    });
    expect(request).not.toHaveProperty("reasoning");
    expect(request).not.toHaveProperty("resolved_configuration");
  });

  it("runs a teammate with its own tools and the Chat tool policy", () => {
    const functionTools = [{ type: "function", function: { name: "run_council" } }];
    const request = toEngineRequest(
      {
        conversationId: "conversation-1",
        messages: [{ role: "user", content: "Convene a council" }],
        settings: {
          tools: [{ type: "function", function: { name: "client_tool" } }],
        },
      },
      {
        teammate: {
          configuration,
          functionTools,
          contextId: "context-1",
          autonomyLevel: "assistant",
          standingApprovals: [],
          approvalStreaks: [],
          delegationId: "delegation-1",
        },
      },
    );

    expect(request).toMatchObject({
      tools: functionTools,
      persona: configuration.persona,
      resolved_configuration: configuration,
      teammate_context_id: "context-1",
      autonomy_level: "assistant",
      delegation_id: "delegation-1",
    });
    expect(
      new PermissionChecker().checkToolAccess({
        toolName: "run_council",
        mode: request.tool_policy_mode,
        toolPermissions: ["orchestration"],
      }),
    ).toMatchObject({ allowed: true, requiresApproval: false });
  });
});
