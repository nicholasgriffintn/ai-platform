import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MarketplaceFilters } from "~/types";

interface MarketplaceStore {
  searchQuery: string;
  selectedCategory: string | null;
  selectedTags: string[];
  sortBy: "popular" | "recent" | "rating" | "name";
  installedAgents: Set<string>;
  installationInProgress: Set<string>;
  viewMode: "grid" | "list";
  showFilters: boolean;
  setSearchQuery: (query: string) => void;
  setCategory: (category: string | null) => void;
  toggleTag: (tag: string) => void;
  setSortBy: (sort: "popular" | "recent" | "rating" | "name") => void;
  clearFilters: () => void;
  addInstalledAgent: (agentId: string) => void;
  removeInstalledAgent: (agentId: string) => void;
  setInstallationInProgress: (agentId: string, inProgress: boolean) => void;
  isAgentInstalled: (agentId: string) => boolean;
  isInstallationInProgress: (agentId: string) => boolean;
  setViewMode: (mode: "grid" | "list") => void;
  toggleFilters: () => void;
  getFilters: () => MarketplaceFilters;
}

export const useMarketplaceStore = create<MarketplaceStore>()(
  persist(
    (set, get) => ({
      searchQuery: "",
      selectedCategory: null,
      selectedTags: [],
      sortBy: "popular",
      installedAgents: new Set(),
      installationInProgress: new Set(),
      viewMode: "grid",
      showFilters: false,
      setSearchQuery: (query) => set({ searchQuery: query }),
      setCategory: (category) => set({ selectedCategory: category }),
      toggleTag: (tag) =>
        set((state) => {
          const newTags = state.selectedTags.includes(tag)
            ? state.selectedTags.filter((t) => t !== tag)
            : [...state.selectedTags, tag];
          return { selectedTags: newTags };
        }),
      setSortBy: (sort) => set({ sortBy: sort }),
      clearFilters: () =>
        set({
          searchQuery: "",
          selectedCategory: null,
          selectedTags: [],
          sortBy: "popular",
        }),
      addInstalledAgent: (agentId) =>
        set((state) => ({
          installedAgents: new Set([...state.installedAgents, agentId]),
        })),
      removeInstalledAgent: (agentId) =>
        set((state) => {
          const newInstalled = new Set(state.installedAgents);
          newInstalled.delete(agentId);
          return { installedAgents: newInstalled };
        }),
      setInstallationInProgress: (agentId, inProgress) =>
        set((state) => {
          const newInProgress = new Set(state.installationInProgress);
          if (inProgress) {
            newInProgress.add(agentId);
          } else {
            newInProgress.delete(agentId);
          }
          return { installationInProgress: newInProgress };
        }),
      isAgentInstalled: (agentId) => get().installedAgents.has(agentId),

      isInstallationInProgress: (agentId) =>
        get().installationInProgress.has(agentId),
      setViewMode: (mode) => set({ viewMode: mode }),
      toggleFilters: () =>
        set((state) => ({ showFilters: !state.showFilters })),
      getFilters: () => {
        const state = get();
        return {
          search: state.searchQuery || undefined,
          category: state.selectedCategory || undefined,
          tags: state.selectedTags.length > 0 ? state.selectedTags : undefined,
          sort: state.sortBy,
        };
      },
    }),
    {
      name: "marketplace-store",
      partialize: (state) => ({
        viewMode: state.viewMode,
        sortBy: state.sortBy,
        selectedCategory: state.selectedCategory,
        selectedTags: state.selectedTags,
      }),
    },
  ),
);
