import type { AssistantRecipe } from "@ngriffin_uk/polychat-schemas";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { useRecipeWorkflows } from "~/components/Apps/Recipes/useRecipeWorkflows";

import { RecipeCapabilityCard } from "./RecipeCapabilityCard";

const recipe = {
  id: "daily-briefing",
  title: "Daily Briefing",
  summary: "Summarise the day",
  description: "Build a daily summary",
  kind: "automate",
  category: "Productivity",
  featured: true,
  integrations: [],
  triggers: [],
  actions: ["Summarise"],
  setupPrompt: "Set up a daily briefing",
  enabledTools: [],
  configurationFields: [],
} satisfies AssistantRecipe;

function createRecipeWorkflows() {
  return {
    connectorSetup: {
      authConfigDialog: { connector: null, configs: [] },
      apiKeyDialog: { open: false, providerId: null, providerName: "" },
      closeApiKeyDialog: vi.fn(),
      closeAuthConfigDialog: vi.fn(),
      connect: vi.fn(async () => undefined),
      connectingProviderId: null,
      isStarting: false,
      onApiKeyStored: vi.fn(async () => undefined),
      selectAuthConfig: vi.fn(),
    },
    configurationDialog: {
      recipe: null,
      installation: null,
      values: {},
      setValues: vi.fn(),
      close: vi.fn(),
      submit: vi.fn(),
      isLoading: false,
    },
    scheduleDialog: {
      recipe: null,
      hasExistingSchedule: false,
      cronExpression: "0 9 * * *",
      prompt: "",
      notifySms: false,
      smsTarget: "",
      setCronExpression: vi.fn(),
      setPrompt: vi.fn(),
      setNotifySms: vi.fn(),
      setSmsTarget: vi.fn(),
      close: vi.fn(),
      submit: vi.fn(),
      isLoading: false,
    },
    deleteDialog: {
      installation: null,
      setInstallation: vi.fn(),
      submit: vi.fn(),
      isLoading: false,
    },
    eventDialog: {
      recipe: null,
      installation: null,
      providers: [],
      close: vi.fn(),
    },
    actions: {
      start: vi.fn(),
      configureProvider: vi.fn(),
      openConfigurationDialog: vi.fn(),
      openScheduleDialog: vi.fn(),
      openEventTriggersDialog: vi.fn(),
      setScheduleEnabled: vi.fn(),
      stopSchedule: vi.fn(),
      toggleInstallationStatus: vi.fn(),
      getRecipeCardState: vi.fn(() => ({
        installation: undefined,
        canManageEventTriggers: false,
        isStarting: false,
        isConfiguring: false,
        isEditingConfiguration: false,
        isScheduling: false,
        isUpdatingInstallation: false,
      })),
    },
  } satisfies ReturnType<typeof useRecipeWorkflows>;
}

describe("RecipeCapabilityCard", () => {
  it("starts personal recipe setup through the recipe workflow", () => {
    const workflows = createRecipeWorkflows();

    render(<RecipeCapabilityCard recipe={recipe} workflows={workflows} />);

    expect(screen.getByRole("img", { name: "Status: Not set up" })).toBeInTheDocument();
    expect(screen.queryByText("Not set up")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Set up" }));

    expect(workflows.actions.start).toHaveBeenCalledWith(recipe, undefined);
  });

  it("collapses supported services into one connection manager", () => {
    const workflows = createRecipeWorkflows();
    const integrations: AssistantRecipe["integrations"] = ["Apollo", "HubSpot", "Stripe"].map(
      (name) => ({
        id: name.toLowerCase(),
        providerId: name.toLowerCase(),
        name,
        description: `${name} integration`,
        requiresConnection: false,
        connectionStatus: "not_required",
      }),
    );
    const connectedRecipe = {
      ...recipe,
      integrations,
    } satisfies AssistantRecipe;

    render(<RecipeCapabilityCard recipe={connectedRecipe} workflows={workflows} />);

    expect(screen.getByRole("button", { name: "Connections, 3" })).toHaveTextContent(
      "Connections3",
    );
    expect(screen.queryByText("Apollo")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Connections, 3" }));
    expect(screen.getByRole("dialog", { name: "Daily Briefing connections" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Connect" })[0]);

    expect(workflows.actions.configureProvider).toHaveBeenCalledWith("apollo", undefined);
  });
});
