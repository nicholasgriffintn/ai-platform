import type {
  AssistantRecipeInstallResponse,
  RecipeInstallation,
} from "@ngriffin_uk/polychat-schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  RECIPE_INSTALLATIONS_QUERY_KEY,
  useInstallAssistantRecipe,
  useUpdateRecipeInstallation,
} from "./useRecipes";

const mocks = vi.hoisted(() => ({
  installAssistantRecipe: vi.fn(),
  updateRecipeInstallation: vi.fn(),
}));

vi.mock("~/lib/api/recipes", () => ({
  deleteRecipeInstallation: vi.fn(),
  installAssistantRecipe: mocks.installAssistantRecipe,
  invokeAssistantRecipe: vi.fn(),
  listAssistantRecipes: vi.fn(),
  listRecipeInstallations: vi.fn(),
  updateRecipeInstallation: mocks.updateRecipeInstallation,
}));

vi.mock("./useCanAccessProFeatures", () => ({
  useCanAccessProFeatures: () => true,
}));

const installation = {
  id: "installation-1",
  recipeId: "daily-weather",
  userId: 42,
  projectId: "project-1",
  status: "active",
  triggers: [{ type: "manual", enabled: true }],
  configuration: { location: "London" },
  createdAt: "2026-08-11T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
} satisfies RecipeInstallation;

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("recipe installation mutations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("puts a newly configured project installation into the scoped cache immediately", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });

    mocks.installAssistantRecipe.mockResolvedValue({
      installation,
    } satisfies Partial<AssistantRecipeInstallResponse>);
    const { result } = renderHook(() => useInstallAssistantRecipe(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        recipeId: installation.recipeId,
        projectId: "project-1",
        configuration: installation.configuration,
      });
    });

    expect(queryClient.getQueryData([...RECIPE_INSTALLATIONS_QUERY_KEY, "project-1"])).toEqual({
      installations: [installation],
    });
  });

  it("replaces the cached installation with the configuration returned by an update", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const updated = { ...installation, configuration: { location: "Edinburgh" } };

    queryClient.setQueryData([...RECIPE_INSTALLATIONS_QUERY_KEY, "project-1"], {
      installations: [installation],
    });
    mocks.updateRecipeInstallation.mockResolvedValue(updated);
    const { result } = renderHook(() => useUpdateRecipeInstallation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        installationId: installation.id,
        update: { configuration: updated.configuration },
      });
    });

    expect(queryClient.getQueryData([...RECIPE_INSTALLATIONS_QUERY_KEY, "project-1"])).toEqual({
      installations: [updated],
    });
  });
});
