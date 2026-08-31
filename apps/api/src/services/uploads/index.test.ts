import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { handleFileUpload } from ".";

const storeSourceFile = vi.hoisted(() => vi.fn());
const convertBlobToMarkdownViaCloudflare = vi.hoisted(() => vi.fn());

vi.mock("~/lib/storage", () => ({
  StorageService: {
    forPrivateAssets: vi.fn(() => ({ storeSourceFile })),
  },
}));

vi.mock("~/lib/documentConverter", () => ({
  convertBlobToMarkdownViaCloudflare,
}));

function createContext(): ServiceContext {
  return {
    env: {},
    repositories: {
      sources: {
        updateSource: vi.fn(),
      },
    },
  } as unknown as ServiceContext;
}

function createUpload(fileType: "document" | "image", mimeType: string, name: string): FormData {
  const formData = new FormData();

  formData.set("file", new File(["file contents"], name, { type: mimeType }));
  formData.set("file_type", fileType);

  return formData;
}

describe("handleFileUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeSourceFile.mockResolvedValue({
      sourceId: "source-1",
      key: "uploads/42/documents/source-1",
      url: "https://assets.example.test/source/source-1",
    });
    convertBlobToMarkdownViaCloudflare.mockResolvedValue({ result: "Converted text" });
  });

  it.each([
    [
      "document",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "document.docx",
    ],
    ["document", "application/vnd.oasis.opendocument.text", "document.odt"],
    ["image", "image/svg+xml", "image.svg"],
    ["image", "image/bmp", "image.bmp"],
  ] as const)("accepts current Cloudflare %s format %s", async (fileType, mimeType, name) => {
    await expect(
      handleFileUpload(createContext(), 42, createUpload(fileType, mimeType, name)),
    ).resolves.toMatchObject({ sourceId: "source-1", name });
  });

  it("forwards a plain-text conversion request to Cloudflare", async () => {
    const formData = createUpload(
      "document",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "document.docx",
    );

    formData.set("conversion_options", JSON.stringify({ output: { format: "text" } }));

    await handleFileUpload(createContext(), 42, formData);

    expect(convertBlobToMarkdownViaCloudflare).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(File),
      "document.docx",
      { output: { format: "text" } },
    );
  });
});
