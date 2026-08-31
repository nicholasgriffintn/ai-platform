import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import {
  getPrivateFileAccessScope,
  getPrivateFileResponse,
  readPrivateFile,
} from "./read-resource";

const personalFile = {
  created_by_user_id: 12,
  project_id: null,
  conversation_id: null,
  storage_key: "private/file",
  mime_type: "text/plain",
  filename: "notes.txt",
};

describe("private file access", () => {
  it("requires current project membership even for the project file creator", () => {
    expect(
      getPrivateFileAccessScope(
        { ...personalFile, project_id: "project-1", created_by_user_id: 12 },
        12,
      ),
    ).toBe("project");
  });

  it("allows the owner to read a personal file", () => {
    expect(getPrivateFileAccessScope(personalFile, 12)).toBe("owner");
  });

  it("only considers conversation visibility for personal conversation files", () => {
    expect(
      getPrivateFileAccessScope({ ...personalFile, conversation_id: "conversation-1" }, 99),
    ).toBe("public-conversation");
    expect(
      getPrivateFileAccessScope({
        ...personalFile,
        project_id: "project-1",
        conversation_id: "conversation-1",
      }),
    ).toBe("denied");
  });

  it("hides output files while durable deletion is pending", async () => {
    const bucketGet = vi.fn();
    const context = {
      env: { PRIVATE_ASSETS_BUCKET: { get: bucketGet } },
      repositories: {
        outputs: {
          getOutput: vi.fn().mockResolvedValue({
            ...personalFile,
            content: JSON.stringify({ deletionPending: true }),
          }),
        },
      },
    } as unknown as ServiceContext;

    await expect(
      readPrivateFile({ context, kind: "output", resourceId: "output-1", userId: 12 }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(bucketGet).not.toHaveBeenCalled();
  });
});

describe("private file responses", () => {
  it("downloads active content instead of rendering it in the API origin", async () => {
    const response = await getPrivateFileResponse(
      { ...personalFile, mime_type: "text/html", filename: "page.html" },
      { arrayBuffer: async () => new ArrayBuffer(0) },
    );

    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="page.html"');
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("renders passive media inline", async () => {
    const response = await getPrivateFileResponse(
      { ...personalFile, mime_type: "image/png", filename: "image.png" },
      { arrayBuffer: async () => new ArrayBuffer(0) },
    );

    expect(response.headers.get("Content-Disposition")).toBe('inline; filename="image.png"');
  });
});
