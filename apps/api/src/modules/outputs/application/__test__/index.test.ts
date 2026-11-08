import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { OutputRecord } from "~/modules/outputs/infrastructure/OutputRepository";

const deleteObject = vi.hoisted(() => vi.fn());

vi.mock("~/infrastructure/storage", () => ({
  StorageService: { forPrivateAssets: vi.fn(() => ({ deleteObject, deletePrefix: vi.fn() })) },
}));

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { formatSharedOutput, getOutput } from "..";

const provenance = {
  protocolVersion: 1,
  capturedAt: "2026-08-11T10:00:00.000Z",
  completeness: "complete",
  origin: "generated",
  run: { id: "run-1", attempt: 2 },
  model: { id: "model-1", provider: "provider-1" },
  skills: [{ id: "research", name: "Research", revision: 4 }],
  sources: [],
  approvals: [],
};

const output: OutputRecord = {
  id: "output-1",
  created_by_user_id: 42,
  project_id: null,
  conversation_id: null,
  parent_output_id: null,
  capability_id: "notes",
  group_id: null,
  collection_id: null,
  kind: "note",
  title: "Launch notes",
  status: "ready",
  sensitivity: "personal",
  content: "{}",
  storage_key: null,
  mime_type: null,
  filename: null,
  byte_size: null,
  revision: 1,
  provenance_json: JSON.stringify(provenance),
  created_at: "2026-08-11T10:00:00.000Z",
  updated_at: null,
};

describe("output shares", () => {
  it("removes private scope and storage fields from public output responses", () => {
    const shared = formatSharedOutput({
      ...output,
      project_id: "project-1",
      conversation_id: "conversation-1",
      storage_key: "private/project-1/output-1.pdf",
      mime_type: "application/pdf",
      filename: "launch.pdf",
      byte_size: 100,
    });

    expect(shared).toEqual(
      expect.objectContaining({
        id: "output-1",
        file: {
          mimeType: "application/pdf",
          filename: "launch.pdf",
          byteSize: 100,
        },
      }),
    );
    expect(shared).not.toHaveProperty("createdByUserId");
    expect(shared).not.toHaveProperty("projectId");
    expect(shared).not.toHaveProperty("conversationId");
    expect(shared).not.toHaveProperty("provenance");
    expect(shared.file).not.toHaveProperty("key");
  });
});

describe("output provenance access", () => {
  it("does not reveal personal provenance across owners", async () => {
    const context = {
      repositories: fakeRepositories([
        [OutputRepository, { getOutput: vi.fn().mockResolvedValue(output) }],
      ]),
    } as unknown as ServiceContext;

    await expect(getOutput(context, 7, output.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("requires current workspace membership before returning project provenance", async () => {
    const projectOutput = { ...output, project_id: "project-1", sensitivity: "internal" as const };
    const context = {
      requireUser: () => ({ id: 7, plan_id: "pro" }),
      repositories: fakeRepositories([
        [OutputRepository, { getOutput: vi.fn().mockResolvedValue(projectOutput) }],
        [
          WorkspaceRepository,
          {
            getProject: vi.fn().mockResolvedValue({ id: "project-1", workspace_id: "workspace-1" }),
            getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
            getMembership: vi.fn().mockResolvedValue(null),
          },
        ],
      ]),
    } as unknown as ServiceContext;

    await expect(getOutput(context, 7, projectOutput.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
