import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ModelConfigItem } from "@assistant/schemas";
import { useChatStore } from "~/state/stores/chatStore";
import { useUsageStore } from "~/state/stores/usageStore";
import type { User } from "~/types";
import { useComposerBannerDismissals } from "./dismissal";
import { ComposerBanner } from "./index";

const useUserMock = vi.fn();
const useRecipeConnectorsMock = vi.fn();
const useWorkspacesMock = vi.fn();

vi.mock("~/hooks/useUser", () => ({
	useUser: (options?: { enabled?: boolean }) => useUserMock(options),
}));

vi.mock("~/hooks/useConnectors", () => ({
	useRecipeConnectors: () => useRecipeConnectorsMock(),
}));

vi.mock("~/hooks/useWorkspaces", () => ({
	useWorkspaces: () => useWorkspacesMock(),
}));

vi.mock("react-router", () => ({
	Link: ({ children, className, to }: { children: ReactNode; className?: string; to: string }) => (
		<a className={className} href={to}>
			{children}
		</a>
	),
}));

const proUser = (messageCount: number) => ({ plan_id: "pro", message_count: messageCount }) as User;
const freeUser = (messageCount: number) =>
	({ plan_id: "free", message_count: messageCount }) as User;

describe("ComposerBanner", () => {
	beforeEach(() => {
		window.localStorage.clear();
		vi.clearAllMocks();
		useUserMock.mockReturnValue({ providerSettings: [], isLoadingProviderSettings: false });
		useRecipeConnectorsMock.mockReturnValue({ data: undefined });
		useWorkspacesMock.mockReturnValue({ data: undefined });
		useChatStore.setState({
			isAuthenticated: false,
			isPro: false,
			user: null,
			hasHydratedUserConfiguration: false,
		});
		useUsageStore.setState({ usageLimits: null });
		useComposerBannerDismissals.setState({ dismissals: {}, cooldownUntil: 0 });
	});

	it("shows the exhausted usage alert ahead of any suggestion", () => {
		useChatStore.setState({
			isAuthenticated: true,
			hasHydratedUserConfiguration: true,
			user: freeUser(30),
		});
		useUsageStore.setState({ usageLimits: { daily: { used: 50, limit: 50 } } });

		render(<ComposerBanner />);

		expect(screen.getByText("Out of messages for today")).toBeInTheDocument();
		expect(screen.getByText("See plans")).toHaveAttribute("href", "/profile?tab=billing");
		expect(screen.queryByText("Bring your own models")).not.toBeInTheDocument();
		expect(screen.queryByLabelText(/Dismiss/)).not.toBeInTheDocument();
	});

	it("warns free users about low usage and stays dismissed for the day", () => {
		useChatStore.setState({ isAuthenticated: true, hasHydratedUserConfiguration: true });
		useUsageStore.setState({ usageLimits: { daily: { used: 45, limit: 50 } } });

		const { unmount } = render(<ComposerBanner />);

		expect(
			screen.getByText(
				"You have 5 messages left today. Pro raises the ceiling, and your own keys remove it.",
			),
		).toBeInTheDocument();

		fireEvent.click(screen.getByLabelText("Dismiss for today"));
		expect(screen.queryByText(/messages left today/)).not.toBeInTheDocument();

		unmount();
		render(<ComposerBanner />);
		expect(screen.queryByText(/messages left today/)).not.toBeInTheDocument();
	});

	it("uses Pro wording for the Pro usage lane", () => {
		useChatStore.setState({ isAuthenticated: true, isPro: true, user: proUser(5) });
		useUsageStore.setState({
			usageLimits: { daily: { used: 0, limit: 200 }, pro: { used: 195, limit: 200 } },
		});

		render(<ComposerBanner />);

		expect(screen.getByText("You have 5 Pro messages left today.")).toBeInTheDocument();
	});

	it("suggests provider setup and honours a permanent dismissal", () => {
		useChatStore.setState({
			isAuthenticated: true,
			hasHydratedUserConfiguration: true,
			user: freeUser(3),
		});

		const { unmount } = render(<ComposerBanner />);

		expect(screen.getByText("Bring your own models")).toBeInTheDocument();
		expect(
			screen.getByText("Add provider keys to use your own models without message limits."),
		).toBeInTheDocument();
		expect(screen.getByText("Open Providers")).toHaveAttribute("href", "/profile?tab=providers");

		fireEvent.click(screen.getByLabelText("Dismiss notification"));
		expect(window.localStorage.getItem("polychat:composer-banner:provider-setup:dismissed")).toBe(
			"forever",
		);

		unmount();
		render(<ComposerBanner />);
		expect(screen.queryByText("Bring your own models")).not.toBeInTheDocument();
	});

	it("suggests connectors to Pro users and rests other suggestions after a dismissal", () => {
		useChatStore.setState({
			isAuthenticated: true,
			isPro: true,
			hasHydratedUserConfiguration: true,
			user: proUser(30),
		});
		useUserMock.mockReturnValue({
			providerSettings: [{ id: "openai", hasApiKey: true }],
			isLoadingProviderSettings: false,
		});
		useRecipeConnectorsMock.mockReturnValue({
			data: { connectors: [{ status: "disconnected" }] },
		});
		useWorkspacesMock.mockReturnValue({ data: { workspaces: [] } });

		const { unmount } = render(<ComposerBanner />);

		expect(screen.getByText("Connect your tools")).toBeInTheDocument();
		fireEvent.click(screen.getByLabelText("Dismiss notification"));

		unmount();
		render(<ComposerBanner />);
		expect(screen.queryByText("Connect your tools")).not.toBeInTheDocument();
		expect(screen.queryByText("Give Work a try")).not.toBeInTheDocument();
	});

	it("pitches Work differently to Pro and free users", () => {
		useChatStore.setState({
			isAuthenticated: true,
			isPro: true,
			hasHydratedUserConfiguration: true,
			user: proUser(30),
		});
		useUserMock.mockReturnValue({
			providerSettings: [{ id: "openai", hasApiKey: true }],
			isLoadingProviderSettings: false,
		});
		useRecipeConnectorsMock.mockReturnValue({
			data: { connectors: [{ status: "connected" }] },
		});
		useWorkspacesMock.mockReturnValue({ data: { workspaces: [] } });

		const { unmount } = render(<ComposerBanner />);
		expect(screen.getByText("Give Work a try")).toBeInTheDocument();
		expect(screen.getByText("Open Work")).toHaveAttribute("href", "/work");
		unmount();

		useChatStore.setState({ isPro: false, user: freeUser(30) });
		useRecipeConnectorsMock.mockReturnValue({ data: undefined });
		useWorkspacesMock.mockReturnValue({ data: undefined });

		render(<ComposerBanner />);
		expect(screen.getByText("Work comes with Pro")).toBeInTheDocument();
		expect(screen.getByText("See plans")).toHaveAttribute("href", "/profile?tab=billing");
	});

	it("hides suggestions but not usage alerts when suggestions are suppressed", () => {
		useChatStore.setState({
			isAuthenticated: true,
			hasHydratedUserConfiguration: true,
			user: freeUser(30),
		});

		const { unmount } = render(<ComposerBanner hideSuggestions />);
		expect(screen.queryByText("Bring your own models")).not.toBeInTheDocument();
		unmount();

		useUsageStore.setState({ usageLimits: { daily: { used: 50, limit: 50 } } });
		render(<ComposerBanner hideSuggestions />);
		expect(screen.getByText("Out of messages for today")).toBeInTheDocument();
	});

	it("keeps the stealth model logging note", () => {
		render(
			<ComposerBanner model={{ id: "openrouter/owl-alpha", status: "alpha" } as ModelConfigItem} />,
		);

		expect(
			screen.getByText(
				"Note: Prompts and completions may be logged by the provider and used to improve the model.",
			),
		).toBeInTheDocument();
	});
});
