import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CopyButton, ShareDialog } from "./index";

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
});
