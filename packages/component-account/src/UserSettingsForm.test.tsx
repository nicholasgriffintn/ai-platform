import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { UserSettings } from "./user-settings";
import { UserSettingsForm, type UserSettingsFormProps } from "./UserSettingsForm";

afterEach(cleanup);

const savedSettings: UserSettings = {
  id: "settings-1",
  nickname: "Alex",
  job_role: "Engineer",
  traits: "Thoughtful",
  preferences: "Use British English",
  guardrails_provider: "bedrock",
  bedrock_guardrail_id: "guardrail-1",
  memories_save_enabled: true,
  tracking_enabled: false,
  search_provider: "exa",
};

const formProps: UserSettingsFormProps = {
  userSettings: null,
  isAuthenticated: true,
  isPro: true,
  onSignIn: vi.fn(),
  onSave: vi.fn().mockResolvedValue(undefined),
};

describe("user settings form", () => {
  it("fills inputs, selections and switches when settings arrive after mounting", () => {
    const { rerender } = render(<UserSettingsForm {...formProps} />);

    rerender(<UserSettingsForm {...formProps} userSettings={savedSettings} />);

    expect(screen.getByLabelText<HTMLInputElement>("Nickname").value).toBe("Alex");
    expect(screen.getByLabelText<HTMLInputElement>("Job Role").value).toBe("Engineer");
    expect(screen.getByLabelText<HTMLTextAreaElement>("Personal Traits").value).toBe("Thoughtful");
    expect(screen.getByLabelText<HTMLTextAreaElement>("Preferences").value).toBe(
      "Use British English",
    );
    expect(screen.getByLabelText<HTMLSelectElement>("Guardrails Provider").value).toBe("bedrock");
    expect(screen.getByLabelText<HTMLInputElement>("Guardrail ID").value).toBe("guardrail-1");
    expect(screen.getByLabelText<HTMLInputElement>("Memories Save Enabled").checked).toBe(true);
    expect(
      screen.getByLabelText<HTMLInputElement>("Allow Prompt and Response Training Data").checked,
    ).toBe(false);
    expect(screen.getByLabelText<HTMLSelectElement>("Search Provider").value).toBe("exa");
  });

  it("loads saved fields while preserving an edit made before settings arrive", () => {
    const { rerender } = render(<UserSettingsForm {...formProps} />);

    fireEvent.change(screen.getByLabelText("Search Provider"), { target: { value: "tavily" } });
    rerender(<UserSettingsForm {...formProps} userSettings={savedSettings} />);

    expect(screen.getByLabelText<HTMLInputElement>("Nickname").value).toBe("Alex");
    expect(screen.getByLabelText<HTMLSelectElement>("Guardrails Provider").value).toBe("bedrock");
    expect(screen.getByLabelText<HTMLSelectElement>("Search Provider").value).toBe("tavily");
  });

  it("refreshes untouched fields while keeping text cleared and switches turned off locally", () => {
    const { rerender } = render(<UserSettingsForm {...formProps} userSettings={savedSettings} />);

    fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "" } });
    fireEvent.click(screen.getByLabelText("Memories Save Enabled"));
    rerender(
      <UserSettingsForm
        {...formProps}
        userSettings={{ ...savedSettings, job_role: "Designer", search_provider: "parallel" }}
      />,
    );

    expect(screen.getByLabelText<HTMLInputElement>("Nickname").value).toBe("");
    expect(screen.getByLabelText<HTMLInputElement>("Memories Save Enabled").checked).toBe(false);
    expect(screen.getByLabelText<HTMLInputElement>("Job Role").value).toBe("Designer");
    expect(screen.getByLabelText<HTMLSelectElement>("Search Provider").value).toBe("parallel");
  });

  it("discards another account's unsaved edits when the settings identity changes", () => {
    const { rerender } = render(<UserSettingsForm {...formProps} userSettings={savedSettings} />);

    fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "Unsaved nickname" } });
    rerender(
      <UserSettingsForm
        {...formProps}
        userSettings={{ ...savedSettings, id: "settings-2", nickname: "Jamie" }}
      />,
    );

    expect(screen.getByLabelText<HTMLInputElement>("Nickname").value).toBe("Jamie");
  });

  it("accepts saved fields independently and continues accepting later settings refreshes", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <UserSettingsForm {...formProps} userSettings={savedSettings} onSave={onSave} />,
    );

    fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "Sam" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    await waitFor(() => expect(screen.getByText("Settings saved successfully!")).toBeTruthy());

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ nickname: "Sam", search_provider: "exa" }),
    );
    rerender(
      <UserSettingsForm
        {...formProps}
        userSettings={{ ...savedSettings, nickname: "Sam", job_role: "Designer" }}
        onSave={onSave}
      />,
    );
    rerender(
      <UserSettingsForm
        {...formProps}
        userSettings={{ ...savedSettings, nickname: "Jamie", job_role: "Designer" }}
        onSave={onSave}
      />,
    );

    expect(screen.getByLabelText<HTMLInputElement>("Nickname").value).toBe("Jamie");
    expect(screen.getByLabelText<HTMLInputElement>("Job Role").value).toBe("Designer");
  });

  it("retains edits after a failed save and submits them alongside refreshed settings on retry", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error("Save failed"))
      .mockResolvedValue(undefined);
    const onSaveError = vi.fn();
    const { rerender } = render(
      <UserSettingsForm
        {...formProps}
        userSettings={savedSettings}
        onSave={onSave}
        onSaveError={onSaveError}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "Sam" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    await waitFor(() => expect(onSaveError).toHaveBeenCalledOnce());
    expect(screen.getByText("Failed to save settings. Please try again.")).toBeTruthy();
    rerender(
      <UserSettingsForm
        {...formProps}
        userSettings={{ ...savedSettings, search_provider: "parallel" }}
        onSave={onSave}
        onSaveError={onSaveError}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ nickname: "Sam", search_provider: "parallel" }),
    );
  });
});
