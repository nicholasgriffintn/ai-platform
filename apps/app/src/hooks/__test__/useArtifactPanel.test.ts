import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useArtifactPanel } from "../useArtifactPanel";

function createArtifact(overrides: Partial<{ identifier: string; content: string }> = {}) {
  return {
    identifier: "artifact-1",
    type: "code",
    title: "Artifact",
    language: "ts",
    content: "content",
    ...overrides,
  } as never;
}

describe("useArtifactPanel", () => {
  it("opens with a single artifact and reports it as not combined", () => {
    const { result } = renderHook(() => useArtifactPanel());
    const artifact = createArtifact();

    act(() => {
      result.current.openArtifact(artifact);
    });

    expect(result.current.isPanelVisible).toBe(true);
    expect(result.current.isCombinedPanel).toBe(false);
    expect(result.current.currentArtifact).toBe(artifact);
    expect(result.current.currentArtifacts).toEqual([]);
  });

  it("opens as a combined panel only when more than one artifact is supplied", () => {
    const { result } = renderHook(() => useArtifactPanel());
    const artifacts = [createArtifact({ identifier: "a" }), createArtifact({ identifier: "b" })];

    act(() => {
      result.current.openArtifact(artifacts[0], true, artifacts);
    });

    expect(result.current.isCombinedPanel).toBe(true);
    expect(result.current.currentArtifacts).toEqual(artifacts);
  });

  it("hides the panel immediately but keeps the artifact until the close transition elapses", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useArtifactPanel());

    act(() => {
      result.current.openArtifact(createArtifact());
    });

    act(() => {
      result.current.closePanel();
    });

    expect(result.current.isPanelVisible).toBe(false);
    expect(result.current.currentArtifact).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.currentArtifact).toBeNull();
    expect(result.current.currentArtifacts).toEqual([]);

    vi.useRealTimers();
  });

  it("does not lose a reopened artifact to a pending close from the previous one", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useArtifactPanel());
    const first = createArtifact({ identifier: "first" });
    const second = createArtifact({ identifier: "second" });

    act(() => {
      result.current.openArtifact(first);
    });

    act(() => {
      result.current.closePanel();
    });

    act(() => {
      result.current.openArtifact(second);
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.currentArtifact).toBe(second);

    vi.useRealTimers();
  });

  it("replaces the open artifact in place without affecting visibility", () => {
    const { result } = renderHook(() => useArtifactPanel());
    const original = createArtifact({ content: "v1" });
    const updated = createArtifact({ content: "v2" });

    act(() => {
      result.current.openArtifact(original);
    });

    act(() => {
      result.current.replaceArtifact(updated);
    });

    expect(result.current.isPanelVisible).toBe(true);
    expect(result.current.currentArtifact).toBe(updated);
  });

  it("closes on Escape only when opted in and the panel is visible", () => {
    const { result } = renderHook(() => useArtifactPanel({ closeOnEscape: true }));

    act(() => {
      result.current.openArtifact(createArtifact());
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(result.current.isPanelVisible).toBe(false);
  });

  it("ignores Escape when closeOnEscape is not set", () => {
    const { result } = renderHook(() => useArtifactPanel());

    act(() => {
      result.current.openArtifact(createArtifact());
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(result.current.isPanelVisible).toBe(true);
  });

  it("invokes onOpen and onClose with the artifact and combined flag", () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const { result } = renderHook(() => useArtifactPanel({ onOpen, onClose }));
    const artifact = createArtifact();

    act(() => {
      result.current.openArtifact(artifact);
    });

    expect(onOpen).toHaveBeenCalledWith(artifact, false);

    act(() => {
      result.current.closePanel();
    });

    expect(onClose).toHaveBeenCalledWith(artifact);
  });
});
