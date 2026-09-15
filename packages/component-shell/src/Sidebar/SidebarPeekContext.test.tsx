import { useUIStore } from "@ngriffin_uk/polychat-library-react";
import { act, cleanup, render } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SIDEBAR_PEEK_CLOSE_DELAY_MS,
  SidebarPeekProvider,
  type SidebarPeekPanelProps,
  type SidebarPeekTriggerProps,
  useSidebarPeekPanel,
  useSidebarPeekTrigger,
} from "./SidebarPeekContext.js";

interface PeekHarness {
  panelProps: SidebarPeekPanelProps;
  peeking: boolean;
  triggerProps: SidebarPeekTriggerProps;
}

type HarnessRef = { current: PeekHarness | null };

function Harness({ harnessRef }: { harnessRef: HarnessRef }) {
  const triggerProps = useSidebarPeekTrigger();
  const { peeking, panelProps } = useSidebarPeekPanel();

  harnessRef.current = { panelProps, peeking, triggerProps };

  return null;
}

function renderHarness(withProvider = true) {
  const harnessRef: HarnessRef = { current: null };
  const harness = <Harness harnessRef={harnessRef} />;

  render(withProvider ? <SidebarPeekProvider>{harness}</SidebarPeekProvider> : harness);

  return harnessRef;
}

function state(harnessRef: HarnessRef): PeekHarness {
  const harness = harnessRef.current;

  if (!harness) {
    throw new Error("Harness did not render");
  }

  return harness;
}

function peeking(harnessRef: HarnessRef): boolean {
  return state(harnessRef).peeking;
}

function pointerEvent(pointerType = "mouse"): ReactPointerEvent<HTMLElement> {
  return { pointerType } as ReactPointerEvent<HTMLElement>;
}

function advancePeekDelay(multiplier = 1) {
  act(() => vi.advanceTimersByTime(SIDEBAR_PEEK_CLOSE_DELAY_MS * multiplier));
}

describe("SidebarPeekProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUIStore.setState({ isMobile: false, sidebarVisible: false });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("keeps the preview open while the pointer travels from the toggle to the panel", () => {
    const harnessRef = renderHarness();

    act(() => state(harnessRef).triggerProps.onPointerEnter(pointerEvent()));
    expect(peeking(harnessRef)).toBe(true);

    act(() => state(harnessRef).triggerProps.onPointerLeave(pointerEvent()));
    advancePeekDelay(0.5);

    expect(peeking(harnessRef)).toBe(true);

    act(() => state(harnessRef).panelProps.onPointerEnter(pointerEvent()));
    advancePeekDelay(2);

    expect(peeking(harnessRef)).toBe(true);

    act(() => state(harnessRef).panelProps.onPointerLeave(pointerEvent()));
    advancePeekDelay();

    expect(peeking(harnessRef)).toBe(false);
  });

  it("hides the preview once the pointer leaves the toggle and the panel", () => {
    const harnessRef = renderHarness();

    act(() => state(harnessRef).triggerProps.onPointerEnter(pointerEvent()));
    act(() => state(harnessRef).triggerProps.onPointerLeave(pointerEvent()));
    advancePeekDelay();

    expect(peeking(harnessRef)).toBe(false);
  });

  it("ignores touch pointers", () => {
    const harnessRef = renderHarness();

    act(() => state(harnessRef).triggerProps.onPointerEnter(pointerEvent("touch")));

    expect(peeking(harnessRef)).toBe(false);
  });

  it("does not preview on mobile or while the sidebar is already visible", () => {
    const harnessRef = renderHarness();

    act(() => useUIStore.setState({ isMobile: true }));
    act(() => state(harnessRef).triggerProps.onPointerEnter(pointerEvent()));
    expect(peeking(harnessRef)).toBe(false);

    act(() => useUIStore.setState({ isMobile: false, sidebarVisible: true }));
    act(() => state(harnessRef).triggerProps.onPointerEnter(pointerEvent()));
    expect(peeking(harnessRef)).toBe(false);
  });

  it("cancels the preview when the toggle is pressed", () => {
    const harnessRef = renderHarness();

    act(() => state(harnessRef).triggerProps.onPointerEnter(pointerEvent()));
    act(() => state(harnessRef).triggerProps.onPointerDown(pointerEvent()));

    expect(peeking(harnessRef)).toBe(false);
  });

  it("is a no-op without a provider", () => {
    const harnessRef = renderHarness(false);

    act(() => state(harnessRef).triggerProps.onPointerEnter(pointerEvent()));

    expect(peeking(harnessRef)).toBe(false);
  });
});
