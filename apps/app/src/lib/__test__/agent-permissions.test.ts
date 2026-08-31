import type { AgentResponse, WorkspaceSummary } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  getAgentPublishTargets,
  resolveAgentManagePermission,
} from "~/lib/agents/agent-permissions";

const agent: AgentResponse = {
  id: "agent-1",
  user_id: 7,
  owner_scope_type: "user",
  owner_scope_id: "7",
  derived_from_agent_id: null,
  name: "Researcher",
  description: "",
  avatar_url: null,
  servers: [],
  model: null,
  temperature: null,
  max_steps: null,
  system_prompt: null,
  few_shot_examples: null,
  enabled_tools: null,
  skill_ids: [],
  mode: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: null,
};

function workspace(role: WorkspaceSummary["role"]): WorkspaceSummary {
  return {
    id: "workspace-1",
    name: "Aviary",
    description: "",
    colour: "#111111",
    role,
    memberCount: 3,
    projectCount: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: null,
  };
}

const workspaceAgent: AgentResponse = {
  ...agent,
  owner_scope_type: "workspace",
  owner_scope_id: "workspace-1",
};

describe("agent manage permission", () => {
  it("lets a workspace admin manage a workspace agent", () => {
    expect(resolveAgentManagePermission(workspaceAgent, 7, [workspace("admin")])).toMatchObject({
      canManage: true,
      ownerLabel: "Aviary",
    });
  });

  it("refuses a plain member of the owning workspace and says why", () => {
    const permission = resolveAgentManagePermission(workspaceAgent, 7, [workspace("member")]);

    expect(permission.canManage).toBe(false);
    expect(permission.reason).toContain("Aviary");
  });

  it("refuses a workspace agent whose workspace the viewer cannot see", () => {
    expect(resolveAgentManagePermission(workspaceAgent, 7, []).canManage).toBe(false);
  });

  it("lets the author manage their own personal agent but nobody else", () => {
    expect(resolveAgentManagePermission(agent, 7, []).canManage).toBe(true);
    expect(resolveAgentManagePermission(agent, 8, []).canManage).toBe(false);
    expect(resolveAgentManagePermission(agent, undefined, []).canManage).toBe(false);
  });

  it("treats an unsaved agent as the viewer's own", () => {
    expect(resolveAgentManagePermission(null, 7, []).canManage).toBe(true);
  });

  it("offers only workspaces the viewer owns or administers as publish targets", () => {
    const targets = getAgentPublishTargets([
      workspace("owner"),
      { ...workspace("member"), id: "workspace-2", name: "Perch" },
    ]);

    expect(targets).toEqual([{ id: "workspace-1", name: "Aviary" }]);
  });
});
