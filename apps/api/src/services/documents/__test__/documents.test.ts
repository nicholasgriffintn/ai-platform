import { DOCUMENT_OUTPUT_KIND } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { IUser } from "~/types";
import { AssistantError } from "~/utils/errors";

import { formatDocument, redescribeDocument, writeDocument } from "../index";

const createOutput = vi.hoisted(() =>
  vi.fn(async (_context: unknown, _userId: number, input: Record<string, unknown>) => ({
    id: "output-1",
    title: input.title,
    revision: 1,
    kind: input.kind,
    content: input.content,
  })),
);
const updateOutput = vi.hoisted(() =>
  vi.fn(async (_context: unknown, _userId: number, id: string, input: Record<string, unknown>) => ({
    id,
    title: input.title ?? "Brief",
    revision: 2,
    kind: DOCUMENT_OUTPUT_KIND,
    content: input.content,
  })),
);
const getOutput = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<Record<string, unknown>>>(),
);
const describeDocument = vi.hoisted(() => vi.fn(async () => ({ tags: ["brief"], summary: "s" })));
const formatDocumentBody = vi.hoisted(() => vi.fn(async () => "# Rewritten"));

vi.mock("~/services/outputs", () => ({ createOutput, updateOutput, getOutput }));
vi.mock("../metadata", () => ({ describeDocument }));
vi.mock("../format", () => ({ formatDocumentBody }));
vi.mock("../from-media", () => ({ generateDocumentFromMedia: vi.fn() }));

const USER = { id: 5, plan_id: "pro" } as unknown as IUser;
const context = {} as unknown as ServiceContext;

function documentOutput(body: string, metadata?: Record<string, unknown>) {
  return {
    id: "output-1",
    title: "Brief",
    revision: 3,
    kind: DOCUMENT_OUTPUT_KIND,
    content: { format: "markdown", body, ...(metadata ? { metadata } : {}) },
  };
}

describe("writeDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    describeDocument.mockResolvedValue({ tags: ["brief"], summary: "s" });
  });

  it("describes a new document and records what a reader would want to know", async () => {
    await writeDocument(context, USER, { title: "Brief", body: "one two three" });

    const content = createOutput.mock.calls[0]?.[2]?.content as Record<string, unknown>;

    expect(content).toMatchObject({
      format: "markdown",
      metadata: { tags: ["brief"], summary: "s", wordCount: 3, readingTime: 1 },
    });
  });

  it("carries the existing description forward when revising", async () => {
    getOutput.mockResolvedValue(documentOutput("old", { sourceType: "manual", tags: ["kept"] }));

    await writeDocument(context, USER, { title: "Brief", body: "new body", outputId: "output-1" });

    expect(describeDocument).toHaveBeenCalledWith(
      expect.objectContaining({ existing: expect.objectContaining({ tags: ["kept"] }) }),
    );
    expect(updateOutput).toHaveBeenCalledWith(
      expect.anything(),
      USER.id,
      "output-1",
      expect.objectContaining({ expectedRevision: 3 }),
    );
  });

  it("skips the description when the caller asks it to", async () => {
    await writeDocument(context, USER, { title: "Brief", body: "body", describe: false });

    expect(describeDocument).not.toHaveBeenCalled();
  });

  it("refuses a document with no title or no body", async () => {
    await expect(writeDocument(context, USER, { title: " ", body: "b" })).rejects.toBeInstanceOf(
      AssistantError,
    );
    await expect(writeDocument(context, USER, { title: "t", body: " " })).rejects.toBeInstanceOf(
      AssistantError,
    );
  });
});

describe("formatDocument and redescribeDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    describeDocument.mockResolvedValue({ tags: ["brief"], summary: "s" });
  });

  it("rewrites a document without saving it, so the reader can decide", async () => {
    getOutput.mockResolvedValue(documentOutput("original"));

    expect(await formatDocument(context, USER, "output-1")).toEqual({ body: "# Rewritten" });
    expect(updateOutput).not.toHaveBeenCalled();
  });

  it("saves a fresh description against the revision it read", async () => {
    getOutput.mockResolvedValue(documentOutput("body text"));

    const result = await redescribeDocument(context, USER, "output-1");

    expect(result.metadata).toMatchObject({ tags: ["brief"] });
    expect(updateOutput).toHaveBeenCalledWith(
      expect.anything(),
      USER.id,
      "output-1",
      expect.objectContaining({ expectedRevision: 3 }),
    );
  });

  it("refuses a result that is not a document", async () => {
    getOutput.mockResolvedValue({ id: "output-1", kind: "image", revision: 1, content: {} });

    await expect(formatDocument(context, USER, "output-1")).rejects.toBeInstanceOf(AssistantError);
    await expect(redescribeDocument(context, USER, "output-1")).rejects.toBeInstanceOf(
      AssistantError,
    );
  });
});
