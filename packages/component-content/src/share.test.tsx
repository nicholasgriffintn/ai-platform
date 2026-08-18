// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ShareDialog } from "./share";

describe("ShareDialog", () => {
  it("emits host-controlled share and copy actions", () => {
    const onShare = vi.fn();
    const onCopy = vi.fn();
    const { rerender } = render(
      <ShareDialog
        type="conversation"
        isOpen
        isPublic={false}
        onOpenChange={vi.fn()}
        onShare={onShare}
        onUnshare={vi.fn()}
        onCopy={onCopy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share Conversation" }));
    expect(onShare).toHaveBeenCalledOnce();

    rerender(
      <ShareDialog
        type="conversation"
        isOpen
        isPublic
        shareUrl="https://example.test/s/1"
        onOpenChange={vi.fn()}
        onShare={onShare}
        onUnshare={vi.fn()}
        onCopy={onCopy}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(onCopy).toHaveBeenCalledWith("https://example.test/s/1");
  });
});
