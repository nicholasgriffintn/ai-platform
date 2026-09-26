// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MusicTransportControls } from "./music";

describe("experience subpaths", () => {
  it("keeps runtime actions host-controlled", () => {
    const onPlay = vi.fn();

    render(<MusicTransportControls isPlaying={false} onPlay={onPlay} onStop={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(onPlay).toHaveBeenCalledOnce();
  });
});
