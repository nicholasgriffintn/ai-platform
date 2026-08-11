import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import { ProductModeHeader } from "./ProductModeHeader";

const trackEvent = vi.fn();

vi.mock("~/hooks/use-track-event", () => ({
	useTrackEvent: () => ({ trackEvent }),
}));

describe("ProductModeHeader", () => {
	beforeEach(() => {
		window.localStorage.clear();
		vi.clearAllMocks();
		useChatStore.setState({ isAuthenticated: true, localOnlyMode: false });
		useUIStore.setState({ isMobile: false, sidebarVisible: true });
	});

	it("places product navigation and the cloud toggle in the chat screen header", () => {
		render(
			<MemoryRouter initialEntries={["/chat"]}>
				<ProductModeHeader showCloudToggle />
			</MemoryRouter>,
		);

		expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute("aria-current", "page");
		expect(screen.getByRole("link", { name: "Work" })).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Switch to local-only mode" }));

		expect(useChatStore.getState().localOnlyMode).toBe(true);
		expect(window.localStorage.getItem("localOnlyMode")).toBe("true");
		expect(screen.getByRole("button", { name: "Switch to cloud mode" })).toBeInTheDocument();
	});

	it("packs mobile navigation beside the actions and leaves the remaining width to context", () => {
		render(
			<MemoryRouter initialEntries={["/chat"]}>
				<ProductModeHeader
					context={<span>Conversation title</span>}
					actions={<button type="button">Trace</button>}
				/>
			</MemoryRouter>,
		);

		const header = screen.getByRole("banner");
		expect(header).toHaveClass("flex", "px-4", "sm:grid");
		expect(header).not.toHaveClass("border-b");
		expect(header.children[0]).toContainElement(screen.getByText("Conversation title"));
		expect(header.children[1]).toContainElement(screen.getByRole("link", { name: "Chat" }));
		expect(header.children[2]).toContainElement(screen.getByRole("button", { name: "Trace" }));
	});

	it("eases in the lower blur only after the content pane has meaningfully scrolled", () => {
		const { container } = render(
			<MemoryRouter initialEntries={["/chat"]}>
				<div>
					<ProductModeHeader />
					<div data-header-scroll-source>Pane content</div>
				</div>
			</MemoryRouter>,
		);

		const header = screen.getByRole("banner");
		const scrollSource = screen.getByText("Pane content");
		const blurEdge = container.querySelector("[data-scroll-blur-edge]");

		expect(header).not.toHaveAttribute("data-content-scrolled");
		expect(blurEdge).toHaveClass("opacity-0");

		Object.defineProperty(scrollSource, "scrollTop", { configurable: true, value: 12 });
		fireEvent.scroll(scrollSource);

		expect(header).toHaveAttribute("data-content-scrolled", "true");
		expect(blurEdge).toHaveClass("opacity-70");

		Object.defineProperty(scrollSource, "scrollTop", { configurable: true, value: 0 });
		fireEvent.scroll(scrollSource);

		expect(header).not.toHaveAttribute("data-content-scrolled");
		expect(blurEdge).toHaveClass("opacity-0");
	});
});
