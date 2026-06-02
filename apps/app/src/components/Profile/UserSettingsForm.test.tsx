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

	it("hydrates the form when user settings arrive after the first render", () => {
		const { rerender } = render(
			<UserSettingsForm isAuthenticated={true} isPro={true} userSettings={null} />,
		);

		expect(screen.getByLabelText("Nickname")).toHaveValue("");

		rerender(
			<UserSettingsForm
				isAuthenticated={true}
				isPro={true}
				userSettings={makeUserSettings({
					nickname: "Updated Nicholas",
					speech_provider: "cartesia",
					speech_model: "sonic-3",
				})}
			/>,
		);

		expect(screen.getByLabelText("Nickname")).toHaveValue("Updated Nicholas");
		expect(screen.getByLabelText("Speech Provider")).toHaveDisplayValue("Cartesia");
		expect(screen.getByLabelText("Speech Model")).toHaveDisplayValue("Sonic 3");
	});

	it("does not overwrite local edits when settings load after the user starts typing", () => {
		const { rerender } = render(
			<UserSettingsForm isAuthenticated={true} isPro={true} userSettings={null} />,
		);

		fireEvent.change(screen.getByLabelText("Nickname"), {
			target: { value: "Local draft" },
		});

		rerender(
			<UserSettingsForm
				isAuthenticated={true}
				isPro={true}
				userSettings={makeUserSettings({
					nickname: "Server nickname",
				})}
			/>,
		);

		expect(screen.getByLabelText("Nickname")).toHaveValue("Local draft");
	});

	it("keeps saved edits visible until refreshed settings catch up", async () => {
		mockUpdateUserSettings.mockResolvedValue(true);

		const initialSettings = makeUserSettings({
			nickname: "Nicholas",
		});
		const { rerender } = render(
			<UserSettingsForm isAuthenticated={true} isPro={true} userSettings={initialSettings} />,
		);

		fireEvent.change(screen.getByLabelText("Nickname"), {
			target: { value: "Updated Nicholas" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));

		await waitFor(() => {
			expect(mockUpdateUserSettings).toHaveBeenCalledWith(
				expect.objectContaining({
					nickname: "Updated Nicholas",
				}),
			);
		});

		rerender(
			<UserSettingsForm isAuthenticated={true} isPro={true} userSettings={initialSettings} />,
		);

		expect(screen.getByLabelText("Nickname")).toHaveValue("Updated Nicholas");

		rerender(
			<UserSettingsForm
				isAuthenticated={true}
				isPro={true}
				userSettings={makeUserSettings({
					nickname: "Updated Nicholas",
				})}
			/>,
		);

		expect(screen.getByLabelText("Nickname")).toHaveValue("Updated Nicholas");
	});
});
