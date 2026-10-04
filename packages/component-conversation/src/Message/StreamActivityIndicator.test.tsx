import { createStreamActivity } from "@ngriffin_uk/polychat-library-chat/response-stats";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StreamActivityIndicator } from "./StreamActivityIndicator";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("StreamActivityIndicator", () => {
  it("updates elapsed time during streaming and stops ticking when activity ends", () => {
    const { rerender, unmount } = render(
      <StreamActivityIndicator label="Thinking" activity={createStreamActivity(0)} />,
    );

    expect(screen.getByText("0s")).toBeTruthy();
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText("2.0s")).toBeTruthy();

    rerender(<StreamActivityIndicator label="Thinking" />);
    expect(screen.queryByText("2.0s")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);

    rerender(
      <StreamActivityIndicator label="Thinking" activity={createStreamActivity(Date.now())} />,
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("1.0s")).toBeTruthy();

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
