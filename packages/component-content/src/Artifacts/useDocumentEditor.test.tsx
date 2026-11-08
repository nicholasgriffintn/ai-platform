import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createDeferred } from "../../test/deferred";
import { documentEditorArtifact } from "../../test/document-editor-fixture";
import { useDocumentEditor } from "./useDocumentEditor";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

describe("document draft revisions", () => {
  it("keeps a dirty draft and saves against the revision the editor started with", async () => {
    const save = vi.fn(async () => undefined);
    const { result, rerender } = renderHook(
      ({ revision, body }) =>
        useDocumentEditor({
          artifact: { ...documentEditorArtifact, content: body },
          sourceRevision: revision,
          onSave: save,
        }),
      { initialProps: { revision: 1, body: "Original body" } },
    );

    act(() => result.current.handleContentChange("My draft"));
    rerender({ revision: 2, body: "Somebody else's edit" });
    expect(result.current.content).toBe("My draft");
    expect(result.current.remoteChanged).toBe(true);
    await act(() => result.current.handleSave());
    expect(save).toHaveBeenCalledWith("My draft", 1);
  });

  it("keeps the new document's revision when a save on the previous document finishes", async () => {
    const deferred = createDeferred<void>();
    const save = vi.fn(() => deferred.promise);
    const { result, rerender } = renderHook(
      ({ identifier, revision, body }) =>
        useDocumentEditor({
          artifact: { ...documentEditorArtifact, identifier, content: body },
          sourceRevision: revision,
          onSave: save,
        }),
      { initialProps: { identifier: "first", revision: 1, body: "First body" } },
    );

    act(() => result.current.handleContentChange("First draft"));
    const pending = result.current.handleSave();

    rerender({ identifier: "second", revision: 8, body: "Second body" });
    await act(async () => {
      deferred.resolve();
      await pending;
    });
    expect(result.current.isDirty).toBe(false);
    act(() => result.current.handleContentChange("Second draft"));
    await act(() => result.current.handleSave());
    expect(save).toHaveBeenLastCalledWith("Second draft", 8);
  });
});
