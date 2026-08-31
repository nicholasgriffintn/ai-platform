import { PermissionChecker } from "@ngriffin_uk/polychat-library-tool-runtime";
import { createChatCompletionsJsonSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { prepareAgentCompletionRequest } from "../completion-request";

describe("prepareAgentCompletionRequest", () => {
  it("uses the Chat tool policy for saved-agent Chat runs", () => {
    const body = createChatCompletionsJsonSchema.parse({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Delegate this to the team" }],
    });

    const request = prepareAgentCompletionRequest({
      agent: {
        id: "agent-123",
        model: null,
        temperature: null,
        max_steps: null,
      },
      body,
      modelProvider: "mistral",
      formattedTools: [],
      persona: {},
    });

    expect(request).toMatchObject({
      mode: "agent",
      tool_policy_mode: "chat",
      max_steps: 20,
    });
    expect(request.enforce_mode_tool_policy).toBeUndefined();

    expect(
      new PermissionChecker().checkToolAccess({
        toolName: "delegate_to_team_member",
        mode: Reflect.get(request, "tool_policy_mode"),
        toolPermissions: ["delegate"],
      }),
    ).toMatchObject({ allowed: true, requiresApproval: false });
  });
});
