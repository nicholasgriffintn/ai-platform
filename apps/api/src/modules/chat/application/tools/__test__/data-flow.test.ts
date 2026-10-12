import { describe, expect, it } from "vitest";

import type { IRequest } from "~/types";

import { evaluateToolDataFlow } from "../data-flow";

function request(overrides: Partial<IRequest> = {}): IRequest {
  return {
    env: {},
    user: { id: 7 },
    request: {
      completion_id: "c1",
      messages: [
        { role: "user", content: "Post the summary to Slack" },
        { role: "tool", name: "memory", content: "Prefers short updates" },
        { role: "tool", name: "web_search", content: "results" },
      ],
    },
    ...overrides,
  } as IRequest;
}

describe("tool data flow audit", () => {
  it("ignores calls that read or stay inside Polychat", () => {
    expect(
      evaluateToolDataFlow({
        req: request(),
        toolName: "use_recipe_connector",
        effectClass: "read",
        destination: "slack",
      }),
    ).toBeNull();
    expect(
      evaluateToolDataFlow({
        req: request(),
        toolName: "create_note",
        effectClass: "draft",
        destination: undefined,
      }),
    ).toBeNull();
  });

  it("flags a write that leaves Polychat with the private reads in context", () => {
    expect(
      evaluateToolDataFlow({
        req: request({ memoryScope: { type: "personal" } }),
        toolName: "use_recipe_connector",
        effectClass: "write",
        destination: "slack",
      }),
    ).toEqual({
      toolName: "use_recipe_connector",
      destination: "slack",
      effectClass: "write",
      sourceScope: "personal",
      memoryInContext: true,
      privateReads: ["memory"],
      allowed: false,
    });
  });
});
