import type { DriveKnowledgeFile } from "@ngriffin_uk/polychat-schemas";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getDriveKnowledgePermissions,
  listDriveKnowledgePage,
  readDriveKnowledgeContent,
} from "./drive.js";
import { createKnowledgeProxyReader } from "./proxy.js";

const document: DriveKnowledgeFile = {
  id: "document",
  name: "Release plan",
  mimeType: "application/vnd.google-apps.document",
  modifiedTime: "2026-10-04T12:00:00Z",
  version: "1",
};

afterEach(() => vi.unstubAllGlobals());

describe("Drive knowledge adapter", () => {
  it("resumes a selected folder scan, traverses subfolders and refuses incomplete results", async () => {
    const read = vi.fn<(endpoint: string) => Promise<unknown>>().mockResolvedValue({
      files: [
        document,
        { ...document, id: "nested", mimeType: "application/vnd.google-apps.folder" },
      ],
      nextPageToken: "next",
    });
    const result = await listDriveKnowledgePage(read, {
      folders: ["root"],
      folderIndex: 0,
      pageToken: "saved",
    });

    expect(result.files).toEqual([document]);
    expect(result.checkpoint).toEqual({
      folders: ["root", "nested"],
      folderIndex: 0,
      pageToken: "next",
    });
    const request = read.mock.calls[0];

    if (!request) {
      throw new Error("Expected a resumed folder request");
    }

    expect(new URL(request[0]).searchParams.get("pageToken")).toBe("saved");
    read.mockResolvedValue({ files: [], incompleteSearch: true });
    await expect(listDriveKnowledgePage(read, result.checkpoint)).rejects.toThrow(
      "incomplete scan",
    );
  });

  it("refreshes all permission pages without accepting groups, deleted or expired grants", async () => {
    const read = vi
      .fn<(endpoint: string) => Promise<unknown>>()
      .mockResolvedValueOnce({
        permissions: [
          { type: "user", role: "reader", emailAddress: "reader@example.com" },
          { type: "group", role: "reader", emailAddress: "group@example.com" },
          { type: "anyone", role: "reader", expirationTime: "2000-01-01T00:00:00Z" },
        ],
        nextPageToken: "permissions-next",
      })
      .mockResolvedValueOnce({
        permissions: [
          { type: "user", role: "writer", emailAddress: "deleted@example.com", deleted: true },
        ],
      });

    expect(await getDriveKnowledgePermissions(read, "document")).toEqual({
      public: false,
      emails: ["reader@example.com"],
      validUntil: null,
    });
    const request = read.mock.calls[1];

    if (!request) {
      throw new Error("Expected a second permission page");
    }

    expect(new URL(request[0]).searchParams.get("pageToken")).toBe("permissions-next");
  });

  it("rejects content that changes during export instead of recording an incorrect version", async () => {
    const read = vi
      .fn<(endpoint: string) => Promise<unknown>>()
      .mockResolvedValueOnce(document)
      .mockResolvedValueOnce("The document text")
      .mockResolvedValueOnce({ ...document, version: "2" });

    await expect(readDriveKnowledgeContent(read, document)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("restricts proxy requests to Drive reads and rejects redirected or oversized responses", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ status: 200, data: "content" })));

    vi.stubGlobal("fetch", fetch);
    const read = createKnowledgeProxyReader({ COMPOSIO_API_KEY: "test-key" }, "account");

    await expect(read("http://www.googleapis.com/drive/v3/files")).rejects.toThrow(
      "outside provider scope",
    );
    await expect(read("https://evil.example/drive/v3/files")).rejects.toThrow(
      "outside provider scope",
    );
    await expect(read("https://www.googleapis.com/drive/v3/files/document")).resolves.toBe(
      "content",
    );
    const options = fetch.mock.calls[0]?.[1];

    if (!options) {
      throw new Error("Expected a provider proxy request");
    }

    expect(JSON.parse(options.body)).toEqual({
      connected_account_id: "account",
      endpoint: "https://www.googleapis.com/drive/v3/files/document",
      method: "GET",
    });
    expect(options.redirect).toBe("error");
    fetch.mockResolvedValue(new Response("{}", { headers: { "content-length": "3000000" } }));
    await expect(read("https://www.googleapis.com/drive/v3/files/document")).rejects.toThrow(
      "size limit",
    );
  });

  it("reads temporary text exports without forwarding account credentials and rejects unsafe storage hosts", async () => {
    const file = {
      url: "https://knowledge.s3.amazonaws.com/export?signature=private",
      content_type: "text/plain",
      size: 13,
      expires_at: "2999-01-01T00:00:00Z",
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 200, binary_data: file })))
      .mockResolvedValueOnce(
        new Response("Document text", { headers: { "content-type": "text/plain" } }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 200,
            binary_data: { ...file, url: "https://ec2-127-0-0-1.compute-1.amazonaws.com/export" },
          }),
        ),
      );

    vi.stubGlobal("fetch", fetch);
    const read = createKnowledgeProxyReader({ COMPOSIO_API_KEY: "test-key" }, "account");

    await expect(
      read("https://www.googleapis.com/drive/v3/files/document/export?mimeType=text%2Fplain"),
    ).resolves.toBe("Document text");
    expect(fetch.mock.calls[1]?.[1]?.headers).toBeUndefined();
    await expect(
      read("https://www.googleapis.com/drive/v3/files/document/export?mimeType=text%2Fplain"),
    ).rejects.toThrow("unsafe file URL");
  });
});
