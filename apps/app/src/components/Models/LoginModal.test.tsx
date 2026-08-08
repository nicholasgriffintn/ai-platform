import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const useAuthStatus = vi.hoisted(() => vi.fn());

vi.mock("@ngriffin_uk/auth-react", () => ({
	AuthFlow: () => null,
	AuthProvider: ({ children }: { children: ReactNode }) => children,
	isWebAuthnSupported: () => true,
}));

vi.mock("~/hooks/useAuth", () => ({ useAuthStatus }));

vi.mock("~/hooks/use-track-event", () => ({
	useTrackEvent: () => ({ trackAuth: vi.fn(), trackError: vi.fn() }),
}));

vi.mock("~/components/ui/Dialog", () => ({
	Dialog: ({ children }: { children: ReactNode }) => children,
	DialogContent: ({ children }: { children: ReactNode }) => children,
	DialogDescription: ({ children }: { children: ReactNode }) => children,
	DialogTitle: ({ children }: { children: ReactNode }) => children,
}));

import { LoginModal } from "./LoginModal";

describe("LoginModal", () => {
	it("closes when authentication completes", async () => {
		useAuthStatus.mockReturnValue({ isAuthenticated: true, isLoading: false });
		const onOpenChange = vi.fn();

		const rendered = render(<LoginModal open onOpenChange={onOpenChange} onKeySubmit={vi.fn()} />);

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(rendered.queryByText("You are already signed in.")).not.toBeInTheDocument();
	});
});
