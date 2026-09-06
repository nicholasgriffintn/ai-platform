import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModelLineup } from "./ModelLineup";

const state = vi.hoisted(() => ({
  isAuthenticated: false,
  account: {} as ModelConfig,
}));

const catalogue: ModelConfig = {
  "gpt-6-astra": {
    id: "gpt-6-astra",
    matchingModel: "gpt-6-astra",
    name: "GPT-6 Astra",
    provider: "openai",
    modalities: { input: ["text"], output: ["text"] },
    reasoningConfig: { supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"] },
  },
  "google-ai-studio/gemini-3.5-flash": {
    id: "google-ai-studio/gemini-3.5-flash",
    matchingModel: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "google-ai-studio",
    isFree: true,
    modalities: { input: ["text"], output: ["text"] },
    reasoningConfig: { supportedEffortLevels: ["minimal", "low", "medium", "high"] },
  },
};

vi.mock("@ngriffin_uk/polychat-library-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-library-client")>()),
  useChatStore: (selector: (value: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: state.isAuthenticated }),
}));

vi.mock("@ngriffin_uk/polychat-library-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-library-react")>()),
  useModelCatalogue: () => ({ data: catalogue, isLoading: false }),
  useModels: () => ({ data: state.account, isLoading: false }),
}));

describe("ModelLineup", () => {
  it("shows the headline model for each tier role from the public catalogue", () => {
    state.isAuthenticated = false;
    render(<ModelLineup />);

    const tiers = screen.getByRole("list", { name: "Model tiers" });
    const ultra = within(tiers).getByRole("heading", { name: "Ultra" }).closest("li");

    expect(ultra).not.toBeNull();
    expect(within(ultra!).getAllByText("GPT-6 Astra").length).toBeGreaterThan(0);
    expect(within(ultra!).queryByText(/On your plan/)).toBeNull();
  });

  it("tells a signed-in account which model its plan actually resolves to", () => {
    state.isAuthenticated = true;
    state.account = {
      "google-ai-studio/gemini-3.5-flash": {
        ...catalogue["google-ai-studio/gemini-3.5-flash"],
        isExecutable: true,
      },
    };
    render(<ModelLineup />);

    const tiers = screen.getByRole("list", { name: "Model tiers" });
    const ultra = within(tiers).getByRole("heading", { name: "Ultra" }).closest("li");

    expect(within(ultra!).getAllByText(/On your plan/).length).toBeGreaterThan(0);
    expect(within(ultra!).getAllByText("Gemini 3.5 Flash").length).toBeGreaterThan(0);
  });
});
