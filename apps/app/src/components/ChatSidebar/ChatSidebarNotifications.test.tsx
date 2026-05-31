import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatSidebarNotifications } from "./ChatSidebarNotifications";

const useUserMock = vi.fn();

vi.mock("~/hooks/useUser", () => ({
	useUser: (options?: { enabled?: boolean }) => useUserMock(options),
}));

vi.mock("react-router", () => ({
	Link: ({ children, className, to }: { children: ReactNode; className?: string; to: string }) => (
		<a className={className} href={to}>
			{children}
		</a>
	),
}));

describe("ChatSidebarNotifications", () => {
	beforeEach(() => {
		window.localStorage.clear();
		vi.clearAllMocks();
		useUserMock.mockReturnValue({
			providerSettings: [],
			isLoadingProviderSettings: false,
		});
	});

	it("lets users permanently dismiss the provider setup notice", () => {
		const { unmount } = render(
			<ChatSidebarNotifications isAuthenticated isPro={false} localOnlyMode={false} />,
		);

		expect(screen.getByText(/Free plan/i)).not.toHaveClass("mb-2");
		expect(screen.getByText(/Add provider keys/i).parentElement).not.toHaveClass("mt-2");

		fireEvent.click(screen.getByLabelText("Dismiss provider setup notice permanently"));

		expect(screen.queryByText(/Add provider keys/i)).not.toBeInTheDocument();
		expect(window.localStorage.getItem("polychat:provider-setup-notice-dismissed")).toBe("true");

		unmount();
		render(<ChatSidebarNotifications isAuthenticated isPro={false} localOnlyMode={false} />);

		expect(screen.queryByText(/Add provider keys/i)).not.toBeInTheDocument();
	});
});
