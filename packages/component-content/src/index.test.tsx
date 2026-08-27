import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CopyButton, ImageModal, ShareDialog } from "./index";

afterEach(cleanup);

describe("content actions", () => {
  it("reports controlled share-dialog transitions and copy requests", () => {
    const onOpenChange = vi.fn();
    const onCopy = vi.fn();

    render(
      <ShareDialog
        type="conversation"
        isOpen
        isPublic
        shareUrl="https://example.com/shared"
        onOpenChange={onOpenChange}
        onShare={vi.fn()}
        onUnshare={vi.fn()}
        onCopy={onCopy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onCopy).toHaveBeenCalledWith("https://example.com/shared");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("sends the configured value through the copy boundary", () => {
    const onCopy = vi.fn();

    render(<CopyButton value="Reusable text" label="Copy response" onCopy={onCopy} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy response" }));
    expect(onCopy).toHaveBeenCalledWith("Reusable text");
  });

  it("traps and restores focus around the enlarged image", async () => {
    render(<ImageModal src="https://example.com/parrot.png" alt="A parrot" />);

    const trigger = screen.getByRole("button", { name: "View A parrot larger" });

    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "A parrot" });

    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});
