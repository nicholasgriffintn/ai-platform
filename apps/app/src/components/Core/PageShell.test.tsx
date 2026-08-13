import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUIStore } from "~/state/stores/uiStore";
import { PageShell } from "./PageShell";

vi.mock("~/layouts/SidebarLayout", () => ({
	SidebarLayout: ({
		children,
		displayNavBar,
	}: {
		children: ReactNode;
		displayNavBar?: boolean;
	}) => <div data-display-nav-bar={displayNavBar}>{children}</div>,
}));

function NestedHeaderFixture() {
	const [showNestedHeader, setShowNestedHeader] = useState(true);

	return (
		<>
			<PageShell.Header title="Experience" />
			{showNestedHeader ? <PageShell.Header title="Loading project" /> : null}
			<button type="button" onClick={() => setShowNestedHeader(false)}>
				Finish loading
			</button>
		</>
	);
}

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

	it("places page titles and page-specific actions in the product header", () => {
		const { container } = render(
			<MemoryRouter initialEntries={["/missing"]}>
				<PageShell
					title="Page Not Found"
					headerActions={<button type="button">Return home</button>}
				>
					<main>Missing page content</main>
				</PageShell>
			</MemoryRouter>,
		);

		const header = screen.getByRole("banner");
		const title = screen.getByRole("heading", { level: 1, name: "Page Not Found" });

		expect(header).toContainElement(title);
		expect(header).toContainElement(screen.getByRole("button", { name: "Return home" }));
		expect(title).toHaveClass("text-sm", "font-medium");
		expect(title).not.toHaveClass("text-2xl", "font-bold");
		expect(container.firstElementChild).toHaveAttribute("data-display-nav-bar", "false");
		const content = screen.getByText("Missing page content").parentElement;
		expect(content).toHaveAttribute("data-header-scroll-source");
		expect(content).toHaveClass("p-4");
		expect(content).not.toHaveClass("py-6", "py-8");
	});

	it("lets nested pages supply the shell header without rendering an in-page heading", () => {
		render(
			<MemoryRouter initialEntries={["/profile?tab=customisation"]}>
				<PageShell title="Profile">
					<PageShell.Header
						title="Customise Chat"
						actions={[
							{
								label: "Save",
								onClick: vi.fn(),
								icon: <span aria-hidden="true">+</span>,
							},
						]}
					/>
					<main>Customisation settings</main>
				</PageShell>
			</MemoryRouter>,
		);

		const header = screen.getByRole("banner");
		expect(header).toContainElement(
			screen.getByRole("heading", { level: 1, name: "Customise Chat" }),
		);
		expect(header).toContainElement(screen.getByRole("button", { name: "Save" }));
		expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
	});

	it("restores the parent page header when a nested loading header unmounts", () => {
		render(
			<MemoryRouter initialEntries={["/work/workspace-1/projects/project-1/experiences/app"]}>
				<PageShell title="Work">
					<NestedHeaderFixture />
				</PageShell>
			</MemoryRouter>,
		);

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Loading project");
		fireEvent.click(screen.getByRole("button", { name: "Finish loading" }));
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Experience");
	});
});
