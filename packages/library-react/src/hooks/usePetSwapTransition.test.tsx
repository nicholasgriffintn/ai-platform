import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PET_SWAP_FADE_MS, usePetSwapTransition } from "./usePetSwapTransition";

describe("usePetSwapTransition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    let nextFrameId = 1;
    const frameTimers = new Map<number, number>();

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const frameId = nextFrameId++;
      const timerId = window.setTimeout(() => {
        frameTimers.delete(frameId);
        callback(0);
      }, 16);

      frameTimers.set(frameId, timerId);

      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (frameId: number) => {
      const timerId = frameTimers.get(frameId);

      if (timerId !== undefined) {
        window.clearTimeout(timerId);
        frameTimers.delete(frameId);
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fades out, swaps, then fades in when the identity changes", () => {
    const { result, rerender } = renderHook(
      ({ pet, transitionEnabled }) => usePetSwapTransition(pet, pet.id, true, transitionEnabled),
      { initialProps: { pet: { id: "pip" }, transitionEnabled: true } },
    );

    rerender({ pet: { id: "ash" }, transitionEnabled: true });
    expect(result.current).toEqual({ displayed: { id: "pip" }, visible: false });

    act(() => vi.advanceTimersByTime(PET_SWAP_FADE_MS));
    expect(result.current).toEqual({ displayed: { id: "ash" }, visible: false });

    act(() => vi.advanceTimersByTime(16));
    expect(result.current).toEqual({ displayed: { id: "ash" }, visible: true });
  });

  it("restarts the pending swap when model selection changes rapidly", () => {
    const { result, rerender } = renderHook(
      ({ pet }) => usePetSwapTransition(pet, pet.id, true, true),
      { initialProps: { pet: { id: "pip" } } },
    );

    rerender({ pet: { id: "ash" } });
    act(() => vi.advanceTimersByTime(PET_SWAP_FADE_MS / 2));
    rerender({ pet: { id: "kea" } });
    act(() => vi.advanceTimersByTime(PET_SWAP_FADE_MS));

    expect(result.current.displayed).toEqual({ id: "kea" });
  });

  it("does not fade when a model change resolves to the same pet", () => {
    const { result, rerender } = renderHook(
      ({ pet }) => usePetSwapTransition(pet, pet.id, true, true),
      { initialProps: { pet: { id: "pip", model: "first" } } },
    );

    rerender({ pet: { id: "pip", model: "second" } });

    expect(result.current.visible).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("swaps immediately when transitions are disabled", () => {
    const { result, rerender } = renderHook(
      ({ pet, transitionEnabled }) => usePetSwapTransition(pet, pet.id, true, transitionEnabled),
      { initialProps: { pet: { id: "pip" }, transitionEnabled: true } },
    );

    rerender({ pet: { id: "ash" }, transitionEnabled: false });

    expect(result.current).toEqual({ displayed: { id: "ash" }, visible: true });
  });

  it("does not transition until the pet selection is ready", () => {
    const { result, rerender } = renderHook(
      ({ pet, ready }) => usePetSwapTransition(pet, pet.id, ready, true),
      { initialProps: { pet: { id: "pip" }, ready: false } },
    );

    rerender({ pet: { id: "ash" }, ready: true });

    expect(result.current).toEqual({ displayed: { id: "ash" }, visible: true });
  });
});
