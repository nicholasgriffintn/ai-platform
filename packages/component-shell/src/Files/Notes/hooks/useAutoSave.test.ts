import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAutoSave } from "./useAutoSave.js";

function deferredSaves() {
  const pending: Array<() => void> = [];
  const onSave = vi.fn(
    (_text: string) => new Promise<void>((resolve) => pending.push(() => resolve())),
  );

  return { onSave, finishNext: () => pending.shift()?.() };
}

describe("useAutoSave", () => {
  it("saves the newest text when the editor closes during a save", async () => {
    const { onSave, finishNext } = deferredSaves();
    const { result, rerender, unmount } = renderHook(
      ({ text }) => useAutoSave({ text, onSave, enabled: true }),
      { initialProps: { text: "first" } },
    );

    rerender({ text: "second" });
    void result.current.forceSave();
    rerender({ text: "third" });
    void result.current.forceSave();
    unmount();

    await act(async () => {
      finishNext();
      await Promise.resolve();
    });

    expect(onSave.mock.calls.map(([text]) => text)).toEqual(["second", "third"]);
  });

  it("does not repeat a save that is already in flight", async () => {
    const { onSave, finishNext } = deferredSaves();
    const { result, rerender } = renderHook(
      ({ text }) => useAutoSave({ text, onSave, enabled: true }),
      { initialProps: { text: "first" } },
    );

    rerender({ text: "second" });
    void result.current.forceSave();
    void result.current.forceSave();

    await act(async () => {
      finishNext();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
