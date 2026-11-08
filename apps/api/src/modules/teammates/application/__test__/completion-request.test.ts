import { PermissionChecker } from "@ngriffin_uk/polychat-library-tools";
import { describe, expect, it } from "vitest";

import { prepareTeammateCompletionRequest } from "../completion-request";

describe("prepareTeammateCompletionRequest", () => {
  it("does not let the caller widen the saved teammate's tools", () => {
    const settings = {
      model: "mistral-large-latest",
      enabled_tools: ["code_execution"],
    };

    const request = prepareTeammateCompletionRequest({
      teammate: {
        id: "teammate-123",
        kind: "colleague" as const,
        model: null,
        temperature: null,
        max_steps: null,
        enabled_tools: '["web_search"]',
        skill_ids: null,
        mode: null,
      },
      settings,
      modelProvider: "mistral",
    });

    expect(request.enabled_tools).toEqual([]);
  });

  it("refuses a denied tool even when the caller asks for it", () => {
    const settings = {
      model: "mistral-large-latest",
      enabled_tools: ["create_task"],
      denied_tools: ["create_task"],
    };

    const request = prepareTeammateCompletionRequest({
      teammate: {
        id: "teammate-123",
        kind: "bot" as const,
        model: null,
        temperature: null,
        max_steps: null,
        enabled_tools: null,
        skill_ids: "[]",
        mode: null,
      },
      settings,
      modelProvider: "mistral",
    });

    expect(request.enabled_tools).toEqual(["create_task"]);
    expect(
      new PermissionChecker().checkToolAccess({
        toolName: "create_task",
        mode: request.mode,
        deniedTools: request.denied_tools,
      }).allowed,
    ).toBe(false);
  });
});
