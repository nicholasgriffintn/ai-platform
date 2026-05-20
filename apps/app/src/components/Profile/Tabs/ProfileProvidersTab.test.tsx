import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileProvidersTab } from "./ProfileProvidersTab";

const useUserMock = vi.fn();
const trackEventMock = vi.fn();

vi.mock("~/hooks/useUser", () => ({
	useUser: () => useUserMock(),
}));

vi.mock("~/hooks/use-track-event", () => ({
	useTrackEvent: () => ({ trackEvent: trackEventMock }),
}));

describe("ProfileProvidersTab", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useUserMock.mockReturnValue({
			providerSettings: [
				{
					id: "provider-settings-row",
					provider_id: "cartesia",
					name: "Cartesia",
					enabled: true,
				},
			],
			isLoadingProviderSettings: false,
			syncProviders: vi.fn(),
			isSyncingProviders: false,
			deleteProviderApiKey: vi.fn().mockResolvedValue(undefined),
			isDeletingProviderApiKey: false,
		});
	});

	it("lets users delete a configured provider", async () => {
		const deleteProviderApiKey = vi.fn().mockResolvedValue(undefined);
		useUserMock.mockReturnValue({
			providerSettings: [
				{
					id: "provider-settings-row",
					provider_id: "cartesia",
					name: "Cartesia",
					enabled: true,
				},
			],
			isLoadingProviderSettings: false,
			syncProviders: vi.fn(),
			isSyncingProviders: false,
			deleteProviderApiKey,
			isDeletingProviderApiKey: false,
		});

		render(<ProfileProvidersTab />);

		fireEvent.click(screen.getByLabelText("Delete provider Cartesia"));
		fireEvent.click(screen.getByRole("button", { name: "Delete Provider" }));

		await waitFor(() => {
			expect(deleteProviderApiKey).toHaveBeenCalledWith({ providerId: "cartesia" });
		});
		expect(trackEventMock).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "delete_provider_api_key",
				value: "cartesia",
			}),
		);
	});

	it("does not show a delete action for unconfigured providers", () => {
		useUserMock.mockReturnValue({
			providerSettings: [
				{
					id: "provider-settings-row",
					provider_id: "cartesia",
					name: "Cartesia",
					enabled: false,
				},
			],
			isLoadingProviderSettings: false,
			syncProviders: vi.fn(),
			isSyncingProviders: false,
			deleteProviderApiKey: vi.fn(),
			isDeletingProviderApiKey: false,
		});

		render(<ProfileProvidersTab />);

		expect(screen.queryByLabelText("Delete provider Cartesia")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Enable")).toBeInTheDocument();
	});
});
