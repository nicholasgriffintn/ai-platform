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
    expect(screen.getByLabelText("Guardrails Provider").textContent).toContain("Bedrock");
    expect(screen.getByLabelText<HTMLInputElement>("Guardrail ID").value).toBe("guardrail-1");
    expect(screen.getByLabelText<HTMLInputElement>("Memories Save Enabled").checked).toBe(true);
    expect(
      screen.getByLabelText<HTMLInputElement>("Allow Prompt and Response Training Data").checked,
    ).toBe(false);
    expect(screen.getByLabelText("Search Provider").textContent).toContain("Exa");
  });

  it("loads saved fields while preserving an edit made before settings arrive", () => {
    const { rerender } = render(<UserSettingsForm {...formProps} />);

    fireEvent.click(screen.getByLabelText("Search Provider"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Tavily" }));
    rerender(<UserSettingsForm {...formProps} userSettings={savedSettings} />);

    expect(screen.getByLabelText<HTMLInputElement>("Nickname").value).toBe("Alex");
    expect(screen.getByLabelText("Guardrails Provider").textContent).toContain("Bedrock");
    expect(screen.getByLabelText("Search Provider").textContent).toContain("Tavily");
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
    expect(screen.getByLabelText("Search Provider").textContent).toContain("Parallel");
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
  it("saves a DynamoDB configuration and removes inactive fields when switching away", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<UserSettingsForm {...formProps} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText("Embedding Provider"));
    fireEvent.click(screen.getByRole("menuitem", { name: "DynamoDB Vectors" }));
    fireEvent.change(screen.getByLabelText("DynamoDB table name"), {
      target: { value: "polychat-vectors" },
    });
    fireEvent.change(screen.getByLabelText("Vector index name"), {
      target: { value: "embeddings" },
    });
    fireEvent.change(screen.getByLabelText("AWS region"), { target: { value: "eu-west-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        embedding_provider: "dynamodb-vectors",
        dynamodb_vectors_table_name: "polychat-vectors",
        dynamodb_vectors_index_name: "embeddings",
        dynamodb_vectors_region: "eu-west-2",
      }),
    );
    fireEvent.click(screen.getByLabelText("Embedding Provider"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Vectorize" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave.mock.calls[1]?.[0]).not.toHaveProperty("dynamodb_vectors_table_name");
  });
});
