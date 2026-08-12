import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUIStore } from "~/state/stores/uiStore";
import { PageShell } from "./PageShell";

vi.mock("~/layouts/SidebarLayout", () => ({
	SidebarLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("PageShell sidebar state", () => {
	beforeEach(() => {
		window.localStorage.clear();
		useUIStore.setState({
			isMobile: false,
			isMobileLoading: true,
			sidebarVisible: false,
		});
		vi.stubGlobal(
			"matchMedia",
			vi.fn().mockReturnValue({
				matches: false,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("preserves a collapsed desktop sidebar across page-shell remounts", () => {
		const { unmount } = render(
			<PageShell sidebarContent={<nav>Sidebar</nav>}>
				<main>Content</main>
			</PageShell>,
		);

		expect(useUIStore.getState().sidebarVisible).toBe(false);

		unmount();
		render(
			<PageShell sidebarContent={<nav>Sidebar</nav>}>
				<main>Content</main>
			</PageShell>,
		);

		expect(useUIStore.getState().sidebarVisible).toBe(false);
	});

	it("updates sidebar visibility only when the responsive breakpoint changes", () => {
		let handleChange: ((event: { matches: boolean }) => void) | undefined;
		vi.stubGlobal(
			"matchMedia",
			vi.fn().mockReturnValue({
				matches: false,
				addEventListener: vi.fn((_eventName, listener) => {
					handleChange = listener;
				}),
				removeEventListener: vi.fn(),
			}),
		);

		render(
			<PageShell sidebarContent={<nav>Sidebar</nav>}>
				<main>Content</main>
			</PageShell>,
		);

		handleChange?.({ matches: true });
		expect(useUIStore.getState()).toMatchObject({
			isMobile: true,
			sidebarVisible: false,
		});

		handleChange?.({ matches: false });
		expect(useUIStore.getState()).toMatchObject({
			isMobile: false,
			sidebarVisible: true,
		});
	});
});
