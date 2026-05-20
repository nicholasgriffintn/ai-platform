import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { UserSettings } from "~/types";
import { UserSettingsForm } from "./UserSettingsForm";

vi.mock("~/hooks/useAuth", () => ({
	useAuthStatus: () => ({
		updateUserSettings: vi.fn(),
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
	it("renders saved Mistral transcription settings with selectable models", () => {
		render(
			<UserSettingsForm
				isAuthenticated={true}
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
});
