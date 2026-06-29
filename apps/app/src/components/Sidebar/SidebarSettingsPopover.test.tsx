import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import { useUsageStore } from "~/state/stores/usageStore";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarSettingsPopover } from "./SidebarSettingsPopover";

const useAuthStatusMock = vi.fn();

vi.mock("~/hooks/useAuth", () => ({
	useAuthStatus: () => useAuthStatusMock(),
}));

vi.mock("react-router", () => ({
	Link: ({ children, className, to }: { children: ReactNode; className?: string; to: string }) => (
		<a className={className} href={to}>
			{children}
		</a>
	),
}));

describe("SidebarSettingsPopover", () => {
	beforeEach(() => {
		window.localStorage.clear();
		Object.defineProperty(window, "matchMedia", {
			writable: true,
			value: vi.fn().mockImplementation((query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})),
		});

		vi.clearAllMocks();
		useChatStore.setState({
			isAuthenticated: true,
			isAuthenticationLoading: false,
		});
		useUIStore.setState({
			showLoginModal: false,
			showKeyboardShortcuts: false,
		});
		useUsageStore.setState({
			usageLimits: {
				daily: { used: 12, limit: 50 },
				pro: { used: 25, limit: 200 },
				byok: { used: 4, limit: null },
			},
		});
		useAuthStatusMock.mockReturnValue({
			user: {
				id: "user-1",
				name: "Nicky",
				avatar_url: "",
			},
			isLoading: false,
		});
	});

	it("opens one settings and configuration popover with usage first", () => {
		render(<SidebarSettingsPopover />);

		const trigger = screen.getByRole("button", { name: "Open settings and configuration" });
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		expect(trigger).toHaveClass("w-full");
		expect(trigger).toHaveClass("rounded-none");
		expect(trigger).not.toHaveClass("border");
		expect(trigger).not.toHaveClass("shadow-sm");
		expect(screen.getByText("Free")).toBeInTheDocument();
		expect(screen.queryByText("Usage, theme, configuration")).not.toBeInTheDocument();

		fireEvent.click(trigger);

		expect(trigger).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByRole("dialog")).toHaveClass(
			"w-[calc(var(--radix-popover-trigger-width)-1rem)]",
		);
		expect(screen.getByRole("dialog")).toHaveClass(
			"max-w-[calc(var(--radix-popover-trigger-width)-1rem)]",
		);
		expect(screen.getByText("Usage")).toBeInTheDocument();
		expect(screen.getByText("Standard lane")).toBeInTheDocument();
		expect(screen.getByText("12 / 50")).toBeInTheDocument();
		expect(screen.getByText("Pro runway")).toBeInTheDocument();
		expect(screen.getByText("25 / 200")).toBeInTheDocument();
		expect(screen.getByText("Your keys")).toBeInTheDocument();
		expect(screen.getByText("4 today")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Customisation" })).toHaveAttribute(
			"href",
			"/profile?tab=customisation",
		);
		expect(screen.getByRole("link", { name: "Providers and keys" })).toHaveAttribute(
			"href",
			"/profile?tab=providers",
		);
	});

	it("uses the whole footer as the trigger surface without wrapper spacing", () => {
		render(<SidebarFooter />);

		const trigger = screen.getByRole("button", { name: "Open settings and configuration" });

		expect(trigger.parentElement).toHaveClass("bg-zinc-50");
		expect(trigger.parentElement).not.toHaveClass("m-2");
		expect(trigger.parentElement).not.toHaveClass("p-2");
	});

	it("keeps theme selection behind a menu item submenu", () => {
		render(<SidebarSettingsPopover />);

		fireEvent.click(screen.getByRole("button", { name: "Open settings and configuration" }));

		const themeButton = screen.getByRole("button", { name: "Theme. Current: System" });
		expect(themeButton).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("button", { name: "Light" })).not.toBeInTheDocument();

		fireEvent.click(themeButton);

		expect(themeButton).toHaveAttribute("aria-expanded", "true");
		fireEvent.click(screen.getByRole("button", { name: "Light" }));

		expect(window.localStorage.getItem("theme")).toBe("light");
	});

	it("opens the login modal from the same popover for signed-out users", () => {
		useChatStore.setState({ isAuthenticated: false });
		useAuthStatusMock.mockReturnValue({
			user: null,
			isLoading: false,
		});

		render(<SidebarSettingsPopover />);

		fireEvent.click(screen.getByRole("button", { name: "Open settings and configuration" }));
		fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

		expect(useUIStore.getState().showLoginModal).toBe(true);
	});
});
