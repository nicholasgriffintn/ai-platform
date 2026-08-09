import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const useAuthStatus = vi.hoisted(() => vi.fn());
const authProviderConfig = vi.hoisted(() => vi.fn());

vi.mock("@ngriffin_uk/auth-react", () => ({
	AuthFlow: () => null,
	AuthProvider: ({ children, config }: { children: ReactNode; config: unknown }) => {
		authProviderConfig(config);
		return children;
	},
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
	it("provides the layout classes required by the shared authentication flow", () => {
		useAuthStatus.mockReturnValue({ isAuthenticated: false, isLoading: false });

		render(<LoginModal open onOpenChange={vi.fn()} onKeySubmit={vi.fn()} />);

		expect(authProviderConfig).toHaveBeenCalledWith(
			expect.objectContaining({
				classNames: expect.objectContaining({
					input: expect.stringMatching(/\bw-full\b.*\bpl-10\b/u),
					inputContainer: expect.stringContaining("relative w-full"),
					inputIcon: expect.stringMatching(/\babsolute\b.*\bleft-3\b/u),
					panel: expect.stringContaining("space-y-3"),
				}),
			}),
		);
	});

	it("closes when authentication completes", async () => {
		useAuthStatus.mockReturnValue({ isAuthenticated: true, isLoading: false });
		const onOpenChange = vi.fn();

		const rendered = render(<LoginModal open onOpenChange={onOpenChange} onKeySubmit={vi.fn()} />);

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(rendered.queryByText("You are already signed in.")).not.toBeInTheDocument();
	});
});
