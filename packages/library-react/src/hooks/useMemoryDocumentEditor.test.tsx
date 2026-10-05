import type { MemoryDocument } from "@ngriffin_uk/polychat-schemas";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { deferred } from "../lib/testing/deferred.js";
import { memoryDocumentFixture } from "../lib/testing/memory-documents.js";
import { useMemoryDocumentEditor } from "./useMemoryDocumentEditor.js";

afterEach(cleanup);

describe("memory content and metadata revisions", () => {
  it("saves a metadata-only edit against the current revision", async () => {
    const document = memoryDocumentFixture();
    const saveDocument = vi.fn().mockResolvedValue(
      memoryDocumentFixture({
        tier: "reference",
        summary: "Research notes",
        revision: 2,
      }),
    );
    const { result } = renderHook(() =>
      useMemoryDocumentEditor({
        document,
        saveDocument,
        loadDocument: vi.fn(),
      }),
    );

    act(() => result.current.editMetadata({ tier: "reference", summary: "Research notes" }));
    expect(result.current.isDirty).toBe(true);
    await act(async () => {
      await result.current.save();
    });
    expect(saveDocument).toHaveBeenCalledWith({
      content: document.content,
      tier: "reference",
      summary: "Research notes",
      expectedRevision: 1,
    });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.base?.revision).toBe(2);
  });

  it("preserves edits made while a revision is being saved", async () => {
    const pending = deferred<MemoryDocument>();
    const saveDocument = vi.fn().mockReturnValue(pending.promise);
    const { result } = renderHook(() =>
      useMemoryDocumentEditor({
        document: memoryDocumentFixture(),
        saveDocument,
        loadDocument: vi.fn(),
      }),
    );

    act(() => result.current.editMetadata({ tier: "reference", summary: "First summary" }));
    let saving: Promise<boolean>;

    act(() => {
      saving = result.current.save();
    });
    act(() => result.current.editMetadata({ tier: "core", summary: "Newer local summary" }));
    await act(async () => {
      pending.resolve(
        memoryDocumentFixture({ tier: "reference", summary: "First summary", revision: 2 }),
      );
      await saving;
    });
    expect(result.current.base).toMatchObject({
      tier: "reference",
      summary: "First summary",
      revision: 2,
    });
    expect(result.current.metadata).toEqual({ tier: "core", summary: "Newer local summary" });
    expect(result.current.isDirty).toBe(true);
  });

  it("resolves an incoming revision for content and metadata together", () => {
    const saveDocument = vi.fn();
    const { result, rerender } = renderHook(
      ({ document }) =>
        useMemoryDocumentEditor({
          document,
          saveDocument,
          loadDocument: vi.fn(),
        }),
      { initialProps: { document: memoryDocumentFixture() } },
    );

    act(() => result.current.editMetadata({ tier: "reference", summary: "Local summary" }));
    rerender({
      document: memoryDocumentFixture({
        content: "Current decision",
        summary: "Remote summary",
        revision: 2,
      }),
    });
    expect(result.current.status).toBe("conflict");
    expect(result.current.metadata.summary).toBe("Local summary");
    act(() => result.current.keepMyEdits());
    expect(result.current.base?.revision).toBe(2);
    expect(result.current.metadata.summary).toBe("Local summary");
    rerender({
      document: memoryDocumentFixture({
        content: "New decision",
        tier: "reference",
        summary: "New remote summary",
        revision: 3,
      }),
    });
    act(() => result.current.useServer());
    expect(result.current.draft).toBe("New decision");
    expect(result.current.metadata).toEqual({ tier: "reference", summary: "New remote summary" });
    expect(result.current.isDirty).toBe(false);
  });
});
