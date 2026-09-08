import type { ModelCatalogItem } from "@ngriffin_uk/polychat-schemas";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModelSelectorPanel, type ModelSelectorPanelProps } from "./ModelSelectorPanel";

const cloud: ModelCatalogItem = {
  id: "cloud",
  matchingModel: "cloud",
  name: "Cloud model",
  provider: "openai",
  isFree: true,
  isFeatured: true,
};
const remote: ModelCatalogItem = {
  id: "remote",
  matchingModel: "remote",
  name: "Remote model",
  provider: "ollama",
  machineId: "office",
  runsOn: "device",
  isExecutable: true,
};
const props: ModelSelectorPanelProps = {
  panelRef: createRef(),
  searchInputRef: createRef(),
  layout: null,
  onKeyDown: vi.fn(),
  runtimeOptions: [
    { site: "hosted", label: "Cloud" },
    { site: "machine", machineId: "office", label: "Office PC" },
  ],
  selectedComputeSite: "hosted",
  onComputeSiteChange: vi.fn(),
  showTiers: true,
  modelTier: null,
  onModelTierChange: vi.fn(),
  searchQuery: "",
  onSearchQueryChange: vi.fn(),
  capabilities: [],
  selectedCapability: null,
  onCapabilityChange: vi.fn(),
  models: [cloud],
  featuredModelIds: { cloud },
  isPro: true,
  onModelSelect: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("model picker navigation", () => {
  it("keeps Auto and model categories reachable in the same picker", () => {
    render(<ModelSelectorPanel {...props} />);
    expect(screen.getByRole("option", { name: "Default tier" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Featured/ }));
    expect(screen.getByRole("option", { name: /Cloud model/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Default tier" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Auto" }));
    expect(screen.getByRole("option", { name: "Default tier" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("radio", { name: "Cloud" }), { key: "ArrowRight" });
    expect(props.onComputeSiteChange).toHaveBeenCalledWith("machine", "office");
  });
  it("shows search results from other locations while Auto was selected", () => {
    render(
      <ModelSelectorPanel
        {...props}
        searchQuery="model"
        models={[cloud, remote]}
        modelLocations={{ cloud: "Cloud", remote: "Office PC" }}
      />,
    );
    expect(screen.queryByRole("option", { name: "Default tier" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("All locations");
    expect(screen.getByRole("radio", { name: "Cloud" }).getAttribute("aria-checked")).toBe("false");
    fireEvent.click(screen.getByRole("option", { name: /Remote model/ }));
    expect(props.onModelSelect).toHaveBeenCalledWith("remote", remote);
  });
  it("bounds broad search rendering and resets pagination when the query changes", () => {
    const models = Array.from({ length: 120 }, (_, index) => ({
      ...cloud,
      id: `model-${index}`,
      matchingModel: `model-${index}`,
      name: `Model ${index}`,
      isFeatured: false,
    }));
    const { rerender } = render(
      <ModelSelectorPanel {...props} searchQuery="model" models={models} />,
    );

    expect(
      screen.getAllByRole("option").filter((option) => option.hasAttribute("data-model-option")),
    ).toHaveLength(50);
    fireEvent.click(screen.getByRole("button", { name: /Show more results/ }));
    expect(
      screen.getAllByRole("option").filter((option) => option.hasAttribute("data-model-option")),
    ).toHaveLength(100);
    rerender(<ModelSelectorPanel {...props} searchQuery="model " models={models} />);
    expect(
      screen.getAllByRole("option").filter((option) => option.hasAttribute("data-model-option")),
    ).toHaveLength(50);
  });
  it("does not execute an unavailable Last used choice", () => {
    render(<ModelSelectorPanel {...props} recentModels={[{ ...remote, isExecutable: false }]} />);
    fireEvent.click(screen.getByRole("button", { name: /Last used/ }));
    const option = screen.getByRole("option", { name: /Remote model/ });

    expect(option.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(option);
    expect(props.onModelSelect).not.toHaveBeenCalled();
  });
});
