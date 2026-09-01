import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPersonalSkillHistory: vi.fn(),
  getPersonalSkillVersion: vi.fn(),
  getProjectSkillHistory: vi.fn(),
  getProjectSkillVersion: vi.fn(),
  handleCreateChatCompletions: vi.fn(),
  requireProjectSkillAdministration: vi.fn(),
  generateId: vi.fn(),
}));

vi.mock("../lifecycle", () => ({
  getPersonalSkillHistory: mocks.getPersonalSkillHistory,
  getPersonalSkillVersion: mocks.getPersonalSkillVersion,
  getProjectSkillHistory: mocks.getProjectSkillHistory,
  getProjectSkillVersion: mocks.getProjectSkillVersion,
}));

vi.mock("../management-policy", () => ({
  requireProjectSkillAdministration: mocks.requireProjectSkillAdministration,
}));

vi.mock("~/services/completions/createChatCompletions", () => ({
  handleCreateChatCompletions: mocks.handleCreateChatCompletions,
}));

vi.mock("~/utils/id", () => ({ generateId: mocks.generateId }));

import { runSkillEvaluation } from "../evaluations";

const content = `---
name: meeting-notes
description: Summarise meetings.
---

# Instructions

Extract actions.`;

const version = {
  id: "skill-internal-1",
  name: "meeting-notes",
  description: "Summarise meetings.",
  scope: { type: "personal" as const },
  createdByUserId: 42,
  createdAt: "2026-09-02T10:00:00.000Z",
  updatedAt: null,
  content,
  resources: [],
  revision: {
    id: "revision-2",
    skillId: "skill-internal-1",
    revision: 2,
    digest: "a".repeat(64),
    size: 100,
    description: "Summarise meetings.",
    changeNote: null,
    sourceSkillId: null,
    sourceRevisionId: null,
    createdByUserId: 42,
    createdAt: "2026-09-02T10:00:00.000Z",
  },
  state: {
    draftRevisionId: "revision-2",
    stableRevisionId: "revision-1",
    stateVersion: 2,
  },
};

function createContext() {
  const createOutput = vi.fn(async (input: any) => ({
    id: input.id,
    created_by_user_id: input.createdByUserId,
    project_id: input.projectId ?? null,
    conversation_id: null,
    parent_output_id: null,
    capability_id: input.capabilityId,
    group_id: input.groupId,
    kind: input.kind,
    title: input.title,
    status: "ready",
    sensitivity: input.projectId ? "internal" : "personal",
    content: JSON.stringify(input.content),
    storage_key: null,
    mime_type: null,
    filename: null,
    byte_size: null,
    revision: 1,
    created_at: "2026-09-02T10:05:00.000Z",
    updated_at: null,
  }));

  return {
    context: {
      env: { AI: {} },
      repositories: {
        outputs: { createOutput },
        templates: { getTemplateById: vi.fn() },
      },
    } as any,
    createOutput,
  };
}

describe("authored skill evaluations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateId.mockReturnValue("output-1");
    mocks.getPersonalSkillVersion.mockResolvedValue(version);
    mocks.handleCreateChatCompletions.mockResolvedValue({
      id: "completion-1",
      object: "chat.completion",
      created: 1,
      model: "test-model",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Action: send the notes" },
          finish_reason: "stop",
        },
      ],
    });
  });

  it("runs an exact draft revision without storing a conversation and records its identity", async () => {
    const { context, createOutput } = createContext();
    const user = { id: 42, email: "owner@example.com", plan_id: "pro" } as any;

    const result = await runSkillEvaluation(context, user, "meeting-notes", {
      revisionId: "revision-2",
      prompt: "What should happen next?",
      expectedContains: "Action:",
    });

    expect(mocks.getPersonalSkillVersion).toHaveBeenCalledWith(
      context,
      42,
      "meeting-notes",
      "revision-2",
    );
    expect(mocks.handleCreateChatCompletions).toHaveBeenCalledWith(
      expect.objectContaining({
        context,
        user,
        request: expect.objectContaining({
          system_prompt: content,
          messages: [{ role: "user", content: "What should happen next?" }],
          stream: false,
          store: false,
          disable_functions: true,
          enabled_tools: [],
        }),
      }),
    );
    expect(createOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: "revision-2",
        content: expect.objectContaining({
          skillId: "skill-internal-1",
          revisionId: "revision-2",
          revision: 2,
          model: "test-model",
          outcome: "passed",
        }),
      }),
      undefined,
    );
    expect(result).toMatchObject({
      skill: "meeting-notes",
      revisionId: "revision-2",
      revision: 2,
      model: "test-model",
      outcome: "passed",
      createdByUserId: 42,
    });
    expect(result).not.toHaveProperty("skillId");
  });

  it("rejects a saved case outside the active project before calling a model", async () => {
    const { context } = createContext();
    const user = { id: 42, email: "admin@example.com", plan_id: "pro" } as any;
    const projectVersion = {
      ...version,
      scope: { type: "project" as const, projectId: "project-1" },
    };

    mocks.getProjectSkillVersion.mockResolvedValue(projectVersion);
    mocks.getProjectSkillHistory.mockResolvedValue({
      skill: projectVersion,
      state: projectVersion.state,
      revisions: [projectVersion.revision],
    });
    context.repositories.templates.getTemplateById.mockResolvedValue({
      id: "case-1",
      created_by_user_id: 42,
      workspace_id: null,
      project_id: "project-2",
      kind: "capability",
      capability_id: "meeting-notes",
      name: "Actions",
      description: "",
      configuration: JSON.stringify({
        type: "authored-skill-evaluation-case",
        skillId: "skill-internal-1",
        prompt: "What next?",
      }),
      status: "active",
      created_at: "2026-09-02T10:00:00.000Z",
      updated_at: "2026-09-02T10:00:00.000Z",
    });

    await expect(
      runSkillEvaluation(
        context,
        user,
        "meeting-notes",
        { revisionId: "revision-2", caseId: "case-1" },
        { projectId: "project-1" },
      ),
    ).rejects.toThrow("Evaluation case not found");
    expect(mocks.handleCreateChatCompletions).not.toHaveBeenCalled();
  });
});
