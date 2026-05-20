import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { UserSettings } from "~/types";
import { UserSettingsForm } from "./UserSettingsForm";

const mockUpdateUserSettings = vi.hoisted(() => vi.fn());

vi.mock("~/hooks/useAuth", () => ({
	useAuthStatus: () => ({
		updateUserSettings: mockUpdateUserSettings,
		isUpdatingUserSettings: false,
	}),
}));

vi.mock("~/hooks/use-track-event", () => ({
	EventCategory: {
		UI_INTERACTION: "ui_interaction",
		USER_JOURNEY: "user_journey",
	},
	useTrackEvent: () => ({
		trackEvent: vi.fn(),
		trackError: vi.fn(),
	}),
}));

const makeUserSettings = (overrides: Partial<UserSettings> = {}): UserSettings => ({
	id: "settings-1",
	nickname: "Nicholas",
	job_role: "Senior Software Engineer",
	traits: "",
	preferences: "",
	...overrides,
});

describe("UserSettingsForm", () => {
	beforeEach(() => {
		mockUpdateUserSettings.mockReset();
	});

	it("renders saved Mistral transcription settings with selectable models", () => {
		render(
			<UserSettingsForm
				isAuthenticated={true}
				isPro={true}
				userSettings={makeUserSettings({
					transcription_provider: "mistral",
					transcription_model: "voxtral-mini",
				})}
			/>,
		);

		expect(screen.getByLabelText("Transcription Provider")).toHaveDisplayValue("Mistral");
		expect(screen.getByLabelText("Transcription Model")).toHaveDisplayValue("Voxtral Mini");
		expect(screen.getByRole("option", { name: "Voxtral Mini" })).toBeInTheDocument();
	});

	it("renders saved speech settings for pro users", () => {
		render(
			<UserSettingsForm
				isAuthenticated={true}
				isPro={true}
				userSettings={makeUserSettings({
					speech_provider: "cartesia",
					speech_model: "sonic-3",
				})}
			/>,
		);

		expect(screen.getByLabelText("Speech Provider")).toHaveDisplayValue("Cartesia");
		expect(screen.getByLabelText("Speech Model")).toHaveDisplayValue("Sonic 3");
	});

	it("hides audio settings and does not submit audio preferences for free users", async () => {
		mockUpdateUserSettings.mockResolvedValue(undefined);

		render(
			<UserSettingsForm
				isAuthenticated={true}
				isPro={false}
				userSettings={makeUserSettings({
					transcription_provider: "mistral",
					transcription_model: "voxtral-mini",
					speech_provider: "cartesia",
					speech_model: "sonic-3",
				})}
			/>,
		);

		expect(screen.queryByLabelText("Transcription Provider")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Speech Provider")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));

		await waitFor(() => expect(mockUpdateUserSettings).toHaveBeenCalledTimes(1));
		expect(mockUpdateUserSettings).toHaveBeenCalledWith(
			expect.not.objectContaining({
				transcription_provider: expect.any(String),
				transcription_model: expect.any(String),
				speech_provider: expect.any(String),
				speech_model: expect.any(String),
			}),
		);
	});
});
