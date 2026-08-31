import { describe, expect, it } from "vitest";

import { createServiceContext } from "~/lib/context/serviceContext";
import { resolveRequestProjectId } from "~/services/functions/request-context";

import { buildToolPermissionsMap, buildToolRequestContext } from "../request-context";

describe("chat request context helpers", () => {
  it("builds tool permission maps from direct and provider-shaped tools", () => {
    expect(
      buildToolPermissionsMap([
        { name: "sandbox", permissions: ["sandbox:write"] },
        { function: { name: "search" }, permissions: ["network:read"] },
        { name: "ignored", permissions: [] },
      ]),
    ).toEqual({
      sandbox: ["sandbox:write"],
      search: ["network:read"],
    });
  });

  it("preserves chat, delegation, and tool context for tool execution", () => {
    const context = buildToolRequestContext({
      chatOptions: {
        env: { AI: {} },
        completion_id: "completion-1",
        app_url: "https://app.test",
        context: createServiceContext({
          env: { AI: {} } as any,
          user: { id: "user-1" } as any,
          requestId: "request-1",
        }),
        messages: [{ role: "user", content: "hello" }],
        approved_tools: ["sandbox"],
        enabled_tools: ["sandbox", "discover_capabilities"],
        tools: [{ name: "sandbox", permissions: ["sandbox:write"] }],
        options: { sandbox: { enabled: true } },
        current_agent_id: "agent-1",
        delegation_stack: ["agent-0"],
        max_delegation_depth: 2,
        enforce_mode_tool_policy: false,
      } as any,
      input: "hello with context",
      mode: "build",
      model: "model-1",
      provider: "provider-1",
      memoryScope: { type: "personal" },
    });

    expect(context).toMatchObject({
      mode: "build",
      app_url: "https://app.test",
      user: { id: "user-1" },
      context: expect.objectContaining({ requestId: "request-1" }),
      request: {
        completion_id: "completion-1",
        input: "hello with context",
        model: "model-1",
        provider: "provider-1",
        mode: "build",
        approved_tools: ["sandbox"],
        enabled_tools: ["sandbox", "discover_capabilities"],
        tool_permissions_map: {
          sandbox: ["sandbox:write"],
        },
        options: { sandbox: { enabled: true } },
        current_agent_id: "agent-1",
        delegation_stack: ["agent-0"],
        max_delegation_depth: 2,
        enforce_mode_tool_policy: false,
      },
    });
    expect(context.request.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("passes only the prepared memory scope to tool execution", () => {
    const context = buildToolRequestContext({
      chatOptions: {
        env: { AI: {} },
        completion_id: "completion-1",
        messages: [{ role: "user", content: "hello" }],
        metadata: { project_id: "untrusted-project" },
      } as any,
      input: "hello",
      mode: "normal",
      model: "model-1",
      provider: "provider-1",
      memoryScope: { type: "project", projectId: "validated-project" },
    });

    expect(context.memoryScope).toEqual({
      type: "project",
      projectId: "validated-project",
    });
    expect(resolveRequestProjectId(context)).toBe("validated-project");
  });
});
