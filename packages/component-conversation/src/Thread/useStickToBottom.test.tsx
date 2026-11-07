import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useEffect, useImperativeHandle, useLayoutEffect, type Ref } from "react";
import type { VListHandle } from "virtua";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStickToBottom } from "./useStickToBottom.js";

const SCROLL_SIZE = 1000;
const VIEWPORT_SIZE = 500;
const BOTTOM_OFFSET = SCROLL_SIZE - VIEWPORT_SIZE;

const scrollToIndex = vi.fn();
let latest: ReturnType<typeof useStickToBottom>;
let scrollsBeforePaint = 0;

const handle = {
  scrollSize: SCROLL_SIZE,
  viewportSize: VIEWPORT_SIZE,
  scrollOffset: BOTTOM_OFFSET,
  scrollToIndex,
} as unknown as VListHandle;

function FakeList({ ref }: { ref: Ref<VListHandle> }) {
  useImperativeHandle(ref, () => handle, []);

  return null;
}

function Harness({
  followKey,
  resetKey = "conversation-1",
  rowCount = 4,
  enabled = true,
}: {
  followKey: string;
  resetKey?: string;
  rowCount?: number;
  enabled?: boolean;
}) {
  const stick = useStickToBottom({ enabled, rowCount, followKey, resetKey });
  const { listRef, viewportRef } = stick;

  useLayoutEffect(() => {
    scrollsBeforePaint = scrollToIndex.mock.calls.length;
  });

  useEffect(() => {
    latest = stick;
  });

  return (
    <section aria-label="viewport" data-testid="viewport" ref={viewportRef}>
      <FakeList ref={listRef} />
    </section>
  );
}

function scrollTo(distanceFromBottom: number) {
  act(() => {
    latest.handleScroll(BOTTOM_OFFSET - distanceFromBottom);
  });
}

describe("useStickToBottom", () => {
  beforeEach(() => {
    scrollToIndex.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("scrolls to the end as soon as the thread renders, without waiting for a frame", () => {
    render(<Harness followKey="loaded" />);

    expect(scrollToIndex).toHaveBeenCalledWith(3, { align: "end" });
  });

  it("asks for the end before the browser can paint the top of the thread", () => {
    render(<Harness followKey="loaded" />);

    expect(scrollsBeforePaint).toBe(1);
  });

  it("targets the newest row when a commit adds rows", () => {
    const { rerender } = render(<Harness followKey="chunk-1" rowCount={4} />);

    scrollToIndex.mockClear();
    rerender(<Harness followKey="chunk-2" rowCount={5} />);

    expect(scrollToIndex).toHaveBeenCalledTimes(1);
    expect(scrollToIndex).toHaveBeenCalledWith(4, { align: "end" });
  });

  it("mounts the newest rows, not the oldest, on the first commit of a long thread", () => {
    render(<Harness followKey="loaded" rowCount={100} />);

    expect(latest.keepMountedRows).toEqual([94, 95, 96, 97, 98, 99]);
  });

  it("stops holding the newest rows once the reader has scrolled away", () => {
    const { getByTestId } = render(<Harness followKey="chunk-1" rowCount={100} />);

    scrollTo(0);
    fireEvent.wheel(getByTestId("viewport"), { deltaY: -400 });
    scrollTo(400);

    expect(latest.keepMountedRows).toBeUndefined();
  });

  it("leaves a list that does not follow the bottom to start at the top", () => {
    render(<Harness followKey="loaded" rowCount={100} enabled={false} />);

    expect(latest.keepMountedRows).toBeUndefined();
  });

  it("follows streamed content while the reader is at the bottom", () => {
    const { rerender } = render(<Harness followKey="chunk-1" />);

    scrollTo(0);
    scrollToIndex.mockClear();

    rerender(<Harness followKey="chunk-2" />);

    expect(scrollToIndex).toHaveBeenCalledWith(3, { align: "end" });
  });

  it("keeps following when a gesture does not actually move the thread", () => {
    const { rerender, getByTestId } = render(<Harness followKey="chunk-1" />);

    scrollTo(0);
    scrollToIndex.mockClear();

    fireEvent.wheel(getByTestId("viewport"), { deltaY: -20 });
    rerender(<Harness followKey="chunk-2" />);

    expect(scrollToIndex).toHaveBeenCalledWith(3, { align: "end" });
  });

  it("releases on a small upward gesture before the reader has left the bottom", () => {
    const { rerender, getByTestId } = render(<Harness followKey="chunk-1" />);

    scrollTo(0);
    scrollToIndex.mockClear();

    fireEvent.wheel(getByTestId("viewport"), { deltaY: -20 });
    scrollTo(20);

    expect(latest.showScrollButton).toBe(true);

    rerender(<Harness followKey="chunk-2" />);

    expect(scrollToIndex).not.toHaveBeenCalled();
  });

  it("does not release when growing content moves the bottom away on its own", () => {
    const { rerender } = render(<Harness followKey="chunk-1" />);

    scrollTo(0);
    scrollToIndex.mockClear();

    scrollTo(600);

    expect(latest.showScrollButton).toBe(false);

    rerender(<Harness followKey="chunk-2" />);

    expect(scrollToIndex).toHaveBeenCalledWith(3, { align: "end" });
  });

  it("resumes following when the reader scrolls back to the bottom", () => {
    const { rerender, getByTestId } = render(<Harness followKey="chunk-1" />);

    scrollTo(0);
    fireEvent.wheel(getByTestId("viewport"), { deltaY: -400 });
    scrollTo(400);

    expect(latest.showScrollButton).toBe(true);

    scrollToIndex.mockClear();
    fireEvent.wheel(getByTestId("viewport"), { deltaY: 400 });
    scrollTo(0);

    expect(latest.showScrollButton).toBe(false);

    rerender(<Harness followKey="chunk-2" />);

    expect(scrollToIndex).toHaveBeenCalledWith(3, { align: "end" });
  });

  it("returns to the bottom when the reader sends a message after scrolling up", () => {
    const { rerender, getByTestId } = render(<Harness followKey="chunk-1" />);

    scrollTo(0);
    fireEvent.wheel(getByTestId("viewport"), { deltaY: -400 });
    scrollTo(400);

    expect(latest.showScrollButton).toBe(true);

    scrollToIndex.mockClear();
    rerender(<Harness followKey="chunk-1" resetKey="conversation-1:message-2" />);

    expect(latest.showScrollButton).toBe(false);
    expect(scrollToIndex).toHaveBeenCalledWith(3, { align: "end" });
  });
});
