import type { SharedAgentSummary } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiService } from "~/lib/api/api-service";

import { AGENTS_QUERY_KEYS } from "./useAgents";
import { capabilityCatalogQueryKey } from "./useCapabilityCatalog";

export const SHARED_AGENTS_QUERY_KEYS = {
  all: ["sharedAgents"],
  featured: ["sharedAgents", "featured"],
  categories: ["sharedAgents", "categories"],
  tags: ["sharedAgents", "tags"],
  listing: (agentId: string) => ["sharedAgents", "listing", agentId],
} as const;

const CATALOGUE_STALE_TIME = 1000 * 60 * 60;
const MARKETPLACE_STALE_TIME = 1000 * 60;

export interface SharedAgentFilterInput {
  category?: string;
  tags?: string[];
  search?: string;
  featured?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: string;
}

export function useSharedAgentCategories(enabled = true) {
  const categoriesQuery = useQuery<string[]>({
    queryKey: SHARED_AGENTS_QUERY_KEYS.categories,
    queryFn: () => apiService.getSharedCategories(),
    enabled,
    staleTime: CATALOGUE_STALE_TIME,
  });
  const tagsQuery = useQuery<string[]>({
    queryKey: SHARED_AGENTS_QUERY_KEYS.tags,
    queryFn: () => apiService.getSharedTags(),
    enabled,
    staleTime: CATALOGUE_STALE_TIME,
  });

  return {
    categories: categoriesQuery.data ?? [],
    tags: tagsQuery.data ?? [],
  };
}

export function useSharedAgents(filters?: SharedAgentFilterInput, enabled = true) {
  const queryClient = useQueryClient();
  const { categories, tags } = useSharedAgentCategories(enabled);

  const { data: sharedAgents = [], isLoading: isLoadingSharedAgents } = useQuery<
    SharedAgentSummary[]
  >({
    queryKey: [...SHARED_AGENTS_QUERY_KEYS.all, filters],
    queryFn: () => apiService.listSharedAgents(filters),
    enabled,
    staleTime: MARKETPLACE_STALE_TIME,
  });

  const { data: featuredAgents = [], isLoading: isLoadingFeaturedAgents } = useQuery<
    SharedAgentSummary[]
  >({
    queryKey: SHARED_AGENTS_QUERY_KEYS.featured,
    queryFn: () => apiService.listFeaturedSharedAgents(filters?.limit),
    enabled,
    staleTime: MARKETPLACE_STALE_TIME,
  });

  const installMutation = useMutation<unknown, Error, string>({
    mutationFn: (sharedAgentId) => apiService.installSharedAgent(sharedAgentId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEYS.all }),
        queryClient.invalidateQueries({ queryKey: capabilityCatalogQueryKey() }),
        queryClient.invalidateQueries({ queryKey: SHARED_AGENTS_QUERY_KEYS.all }),
      ]);
      toast.success("Agent installed");
    },
    onError: (error) => {
      toast.error(`Failed to install agent: ${error.message}`);
    },
  });

  return {
    sharedAgents,
    isLoadingSharedAgents,
    featuredAgents,
    isLoadingFeaturedAgents,
    installSharedAgent: installMutation.mutateAsync,
    isInstalling: installMutation.isPending,
    categories,
    tags,
  };
}

export interface ShareAgentInput {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
}

export function useAgentSharing(agentId: string | null) {
  const queryClient = useQueryClient();
  const { categories } = useSharedAgentCategories(agentId !== null);

  const listingQuery = useQuery<SharedAgentSummary | null>({
    queryKey: SHARED_AGENTS_QUERY_KEYS.listing(agentId ?? ""),
    queryFn: () => apiService.getSharedAgentListingForAgent(agentId ?? ""),
    enabled: agentId !== null,
    staleTime: MARKETPLACE_STALE_TIME,
  });

  const refreshMarketplace = async () => {
    await queryClient.invalidateQueries({ queryKey: SHARED_AGENTS_QUERY_KEYS.all });
  };

  const shareMutation = useMutation<unknown, Error, ShareAgentInput>({
    mutationFn: ({ name, description, category, tags }) => {
      if (!agentId) {
        throw new Error("No agent selected to share");
      }

      return apiService.shareAgent(agentId, name, description, undefined, category, tags);
    },
    onSuccess: async () => {
      await refreshMarketplace();
      toast.success("Agent shared");
    },
    onError: (error) => {
      toast.error(`Failed to share agent: ${error.message}`);
    },
  });

  const unshareMutation = useMutation<void, Error, string>({
    mutationFn: (sharedAgentId) => apiService.unshareAgent(sharedAgentId),
    onSuccess: async () => {
      await refreshMarketplace();
      toast.success("Agent removed from the marketplace");
    },
    onError: (error) => {
      toast.error(`Failed to stop sharing agent: ${error.message}`);
    },
  });

  return {
    categories,
    listing: listingQuery.data ?? null,
    isLoadingListing: agentId !== null && listingQuery.isLoading,
    listingError: listingQuery.error,
    shareAgent: shareMutation.mutateAsync,
    isSharing: shareMutation.isPending,
    unshareAgent: unshareMutation.mutateAsync,
    isUnsharing: unshareMutation.isPending,
  };
}
