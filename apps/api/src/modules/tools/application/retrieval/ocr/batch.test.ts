import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import type { IUser } from "~/types";

import { startOcrBatch } from "./batch";

const {
  createOutput,
  enqueueTask,
  getOutput,
  readPrivateFile,
  requireOcrAccess,
  requireOutputAccess,
  requireProjectAccess,
  updateOutput,
} = vi.hoisted(() => ({
  createOutput: vi.fn(),
  getOutput: vi.fn(),
  updateOutput: vi.fn(),
  enqueueTask: vi.fn(),
  readPrivateFile: vi.fn(),
  requireOcrAccess: vi.fn(),
  requireOutputAccess: vi.fn(),
  requireProjectAccess: vi.fn(),
}));

vi.mock("~/modules/outputs/application", () => ({
  createOutput,
  getOutput,
  updateOutput,
}));

vi.mock("~/modules/queue/application/TaskService", () => ({
  TaskService: class {
    enqueueTask = enqueueTask;
  },
}));

vi.mock("~/infrastructure/storage/read-resource", () => ({ readPrivateFile }));
vi.mock("@ngriffin_uk/polychat-ai-providers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-providers")>()),
  requireOcrAccess,
}));
vi.mock("~/infrastructure/providers/host", () => ({ providerHost: {} }));
vi.mock("~/infrastructure/providers/runtime", () => ({ providerRuntime: {} }));
vi.mock("~/modules/outputs/application/access", () => ({ requireOutputAccess }));
vi.mock("~/modules/workspaces/application/access", () => ({ requireProjectAccess }));

describe("startOcrBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOcrAccess.mockResolvedValue(undefined);
    requireOutputAccess.mockResolvedValue({});
    requireProjectAccess.mockResolvedValue({});
    createOutput.mockResolvedValue({
      id: "batch-output-1",
      revision: 1,
      content: {},
    });
    updateOutput.mockResolvedValue({
      id: "batch-output-1",
      revision: 2,
      content: {},
    });
    enqueueTask.mockResolvedValue("ocr-batch:batch-output-1:0");
  });

  it("rejects users without OCR access before provider spend", async () => {
    requireOcrAccess.mockRejectedValueOnce(new Error("OCR access denied"));
    const batchClient = {
      start: vi.fn(),
      cancel: vi.fn(),
      get: vi.fn(),
      downloadFile: vi.fn(),
      deleteJob: vi.fn(),
      deleteFile: vi.fn(),
    };
    const context = { env: {}, repositories: {} } as unknown as ServiceContext;

    await expect(
      startOcrBatch(
        context,
        { id: 42 } as IUser,
        {
          title: "Denied",
          model: "mistral-ocr-latest",
          requests: [
            {
              document: {
                type: "document_url",
                document_url: "https://example.com/report.pdf",
              },
            },
          ],
        },
        { batchClient },
      ),
    ).rejects.toThrow("OCR access denied");
    expect(createOutput).not.toHaveBeenCalled();
    expect(batchClient.start).not.toHaveBeenCalled();
  });

  it("rejects a private input outside the requested project scope before provider spend", async () => {
    const batchClient = {
      start: vi.fn(),
      cancel: vi.fn(),
      get: vi.fn(),
      downloadFile: vi.fn(),
      deleteJob: vi.fn(),
      deleteFile: vi.fn(),
    };
    const context = {
      env: {},
      repositories: fakeRepositories([
        [OutputRepository, { attachSources: vi.fn() }],
        [TaskRepository, {}],
      ]),
    } as unknown as ServiceContext;

    readPrivateFile.mockResolvedValue({
      record: {
        project_id: "project-2",
        storage_key: "uploads/42/documents/report.pdf",
        mime_type: "application/pdf",
        filename: "report.pdf",
      },
      object: { arrayBuffer: vi.fn() },
    });

    await expect(
      startOcrBatch(
        context,
        { id: 42 } as IUser,
        {
          title: "Wrong project",
          model: "mistral-ocr-latest",
          requests: [{ document: { type: "source", source_id: "source-1" } }],
        },
        { projectId: "project-1", batchClient },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(batchClient.start).not.toHaveBeenCalled();
    expect(createOutput).not.toHaveBeenCalled();
  });
});
