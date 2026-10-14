import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { OutputRecord } from "~/modules/outputs/infrastructure/OutputRepository";
import type { IUser } from "~/types";

import { cancelJob, listJobs, readJob } from "../jobs";

vi.mock("~/modules/workspaces/application/access", () => ({
  requireOptionalProjectCapabilityAccess: vi.fn(async () => undefined),
  requireProjectAccess: vi.fn(async () => undefined),
}));

function output(overrides: Partial<OutputRecord>): OutputRecord {
  return {
    id: "output",
    created_by_user_id: 7,
    project_id: null,
    conversation_id: null,
    parent_output_id: null,
    capability_id: "replicate",
    group_id: null,
    kind: "prediction",
    title: "Prediction",
    status: "pending",
    sensitivity: "personal",
    content: JSON.stringify({ status: "processing", modelId: "flux", input: {} }),
    storage_key: null,
    mime_type: null,
    filename: null,
    byte_size: null,
    revision: 1,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: null,
    ...overrides,
  };
}

const records = [
  output({ id: "replicate-old", created_at: "2026-10-01T00:00:00.000Z" }),
  output({
    id: "evaluation-new",
    capability_id: "site_evaluation",
    kind: "site_evaluation",
    status: "ready",
    content: JSON.stringify({ request: {} }),
    created_at: "2026-10-03T00:00:00.000Z",
  }),
  output({
    id: "canvas-mid",
    capability_id: "canvas",
    content: JSON.stringify({ status: "succeeded", modelId: "flux", mode: "image" }),
    created_at: "2026-10-02T00:00:00.000Z",
  }),
];

function createContext() {
  const outputs = {
    listPersonalOutputs: vi.fn(async (_userId: number, capability: string) =>
      records.filter((record) => record.capability_id === capability),
    ),
    getPersonalOutput: vi.fn(
      async (_userId: number, id: string) => records.find((record) => record.id === id) ?? null,
    ),
  };

  return { repositories: { outputs } } as unknown as ServiceContext;
}

const user = { id: 7 } as IUser;

describe("jobs", () => {
  it("lists every kind newest first and pages by cursor", async () => {
    const context = createContext();

    const first = await listJobs(context, user, { limit: 2 });
    const second = await listJobs(context, user, { limit: 2, after: first.last_id ?? undefined });

    expect(first.data.map((job) => [job.id, job.kind])).toEqual([
      ["evaluation-new", "site_evaluation"],
      ["canvas-mid", "canvas_generation"],
    ]);
    expect(first.has_more).toBe(true);
    expect(second.data.map((job) => job.id)).toEqual(["replicate-old"]);
    expect(second.has_more).toBe(false);
  });

  it("reads an output that is not a job as not found", async () => {
    const context = createContext();

    records.push(output({ id: "note", capability_id: "notes" }));

    await expect(readJob(context, user, "note", {})).rejects.toThrow("Job not found");
  });

  it("refuses to cancel a kind that cannot be cancelled", async () => {
    const context = createContext();

    await expect(cancelJob(context, user, "replicate-old", {})).rejects.toThrow(
      "cannot be cancelled",
    );
  });
});
