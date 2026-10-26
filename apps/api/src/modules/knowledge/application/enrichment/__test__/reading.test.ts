import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";

import { readingEnricher } from "../reading";

const extractValues = vi.hoisted(() => vi.fn());
const readSourceImageDataUrl = vi.hoisted(() => vi.fn(async () => "data:image/jpeg;base64,AAAA"));

vi.mock("~/modules/extractions/application/extract", () => ({ extractValues }));
vi.mock("~/modules/sources/application/media/file-material", () => ({
  isSourceImage: (source: SourceRecord) => source.mime_type === "image/jpeg",
  isSourcePdf: (source: SourceRecord) => source.mime_type === "application/pdf",
  readSourceImageDataUrl,
  readSourcePdfText: vi.fn(async () => "INVOICE 42 total 90.00"),
}));

const context = { env: {}, requireUser: () => ({ id: 7 }) } as unknown as ServiceContext;

function file(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: "file-1",
    created_by_user_id: 7,
    project_id: null,
    conversation_id: null,
    connection_id: null,
    kind: "file",
    title: "Receipt",
    status: "available",
    content: null,
    provider: null,
    external_uri: null,
    vector_id: null,
    metadata: "{}",
    storage_key: "uploads/7/images/receipt.jpg",
    mime_type: "image/jpeg",
    filename: "receipt.jpg",
    byte_size: 1024,
    revision: 1,
    created_at: "2026-10-12T09:30:00.000Z",
    updated_at: null,
    ...overrides,
  };
}

function input(source: SourceRecord, metadata: Record<string, unknown>, text = "") {
  return {
    source,
    metadata,
    text,
    contentHash: "hash-1",
    scope: { userId: 7, projectId: null },
  };
}

describe("readingEnricher", () => {
  beforeEach(() => {
    readSourceImageDataUrl.mockClear();
    extractValues.mockReset();
    extractValues.mockResolvedValue({
      provider: "workers-ai",
      model: "clairic",
      answers: { total: { type: "number", value: 12.5, confidence: 0.97 } },
      truncated: false,
      state_text: "TOTAL 12.50",
      usage: { input_tokens: 1, output_tokens: 1 },
    });
  });

  it("skips a file nobody has asked to read", async () => {
    await expect(readingEnricher.run(context, input(file(), {}))).resolves.toEqual({
      status: "skipped",
    });
    expect(extractValues).not.toHaveBeenCalled();
  });

  it("reads a photo from the image and keeps the text the model saw for highlighting", async () => {
    const result = await readingEnricher.run(context, input(file(), { readAs: "receipt" }));

    expect(extractValues.mock.calls[0]?.[0].request).toMatchObject({
      images: ["data:image/jpeg;base64,AAAA"],
      reference_date: "2026-10-12",
    });
    expect(result.value).toMatchObject({ form: "receipt", text: "TOTAL 12.50", model: "clairic" });
  });

  it("reads a PDF with no stored text through its converted text and keeps that text", async () => {
    extractValues.mockResolvedValueOnce({
      provider: "workers-ai",
      model: "clairic",
      answers: {},
      truncated: false,
      state_text: "INVOICE 42 total 90.00",
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    const result = await readingEnricher.run(
      context,
      input(file({ mime_type: "application/pdf", filename: "invoice.pdf" }), { readAs: "invoice" }),
    );

    expect(extractValues.mock.calls[0]?.[0].request).toMatchObject({
      state: "INVOICE 42 total 90.00",
    });
    expect(result.value).toMatchObject({ text: "INVOICE 42 total 90.00" });
  });

  it("reads text through its state and leaves highlighting to the file's own text", async () => {
    const result = await readingEnricher.run(
      context,
      input(
        file({ kind: "text", mime_type: null, storage_key: null }),
        { readAs: "invoice" },
        "INV-1",
      ),
    );

    expect(extractValues.mock.calls[0]?.[0].request).toMatchObject({ state: "INV-1" });
    expect(readSourceImageDataUrl).not.toHaveBeenCalled();
    expect(result.value).toMatchObject({ form: "invoice", text: null });
  });
});
