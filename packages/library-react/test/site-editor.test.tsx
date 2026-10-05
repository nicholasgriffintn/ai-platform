import { sitesService } from "@ngriffin_uk/polychat-library-client";
import type { SiteRecord } from "@ngriffin_uk/polychat-schemas";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDeferred } from "../../component-content/test/deferred";
import { useSiteGeneration } from "../src/hooks/useSites";
import { savedSite, siteEditorWrapper } from "./site-editor";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Site draft persistence", () => {
  it("retains a failed draft and includes later edits when the person retries", async () => {
    const initial = savedSite("first");
    const edit = vi
      .spyOn(sitesService, "edit")
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce({ ...initial, revision: 2 });
    const hook = renderHook(() => useSiteGeneration({ initialSite: initial, autoImages: false }), {
      wrapper: siteEditorWrapper(),
    });

    act(() =>
      hook.result.current.edit([{ op: "replace", path: "/title", value: "Edited" }], "Title"),
    );
    await act(() => vi.advanceTimersByTimeAsync(800));
    expect(hook.result.current.hasUnsavedEdits).toBe(true);
    expect(hook.result.current.state.project?.title).toBe("Edited");
    expect(hook.result.current.state.error).toBe("Connection lost");
    act(() =>
      hook.result.current.edit(
        [{ op: "add", path: "/description", value: "Later edit" }],
        "Description",
      ),
    );
    await act(() => hook.result.current.retryEdits());
    expect(edit.mock.calls[1]?.[1]).toMatchObject({
      expectedRevision: 1,
      patches: [
        { op: "replace", path: "/title", value: "Edited" },
        { op: "add", path: "/description", value: "Later edit" },
      ],
    });
    expect(hook.result.current.state.project?.description).toBe("Later edit");
    expect(hook.result.current.hasUnsavedEdits).toBe(false);
  });

  it("ignores the old Site response and saves queued edits to the newly opened Site", async () => {
    const first = savedSite("first");
    const second = savedSite("second");
    const outstanding = createDeferred<SiteRecord>();
    const edit = vi
      .spyOn(sitesService, "edit")
      .mockReturnValueOnce(outstanding.promise)
      .mockResolvedValueOnce({ ...second, revision: 2 });
    const hook = renderHook(() => useSiteGeneration({ initialSite: first, autoImages: false }), {
      wrapper: siteEditorWrapper(),
    });

    act(() =>
      hook.result.current.edit([{ op: "replace", path: "/title", value: "Old draft" }], "Title"),
    );
    await act(() => vi.advanceTimersByTimeAsync(800));
    act(() => hook.result.current.load(second));
    act(() =>
      hook.result.current.edit([{ op: "replace", path: "/title", value: "New draft" }], "Title"),
    );
    await act(() => vi.advanceTimersByTimeAsync(800));
    await act(async () => outstanding.resolve({ ...first, revision: 2 }));
    expect(hook.result.current.state.site?.id).toBe("second");
    expect(hook.result.current.state.project?.title).toBe("New draft");
    await act(() => vi.advanceTimersByTimeAsync(800));
    expect(edit.mock.calls[1]?.[0]).toBe("second");
    expect(edit.mock.calls[1]?.[1]).toMatchObject({ expectedRevision: 1 });
    expect(hook.result.current.hasUnsavedEdits).toBe(false);
    expect(hook.result.current.state.site?.id).toBe("second");
  });
});
