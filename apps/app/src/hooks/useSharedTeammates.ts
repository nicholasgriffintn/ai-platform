import type { SharedTeammateSummary } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiService } from "~/lib/api/api-service";

import { capabilityCatalogQueryKey } from "./useCapabilityCatalog";
import { TEAMMATES_QUERY_KEYS } from "./useTeammates";

export const SHARED_TEAMMATES_QUERY_KEYS = {
  all: ["sharedAgents"],
  featured: ["sharedAgents", "featured"],
  categories: ["sharedAgents", "categories"],
  tags: ["sharedAgents", "tags"],
  listing: (teammateId: string) => ["sharedAgents", "listing", teammateId],
} as const;

const CATALOGUE_STALE_TIME = 1000 * 60 * 60;
const MARKETPLACE_STALE_TIME = 1000 * 60;

export interface SharedTeammateFilterInput {
  category?: string;
  tags?: string[];
  search?: string;
  featured?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: string;
}

export function useSharedTeammateCategories(enabled = true) {
  const categoriesQuery = useQuery<string[]>({
    queryKey: SHARED_TEAMMATES_QUERY_KEYS.categories,
    queryFn: () => apiService.getSharedCategories(),
    enabled,
    staleTime: CATALOGUE_STALE_TIME,
  });
  const tagsQuery = useQuery<string[]>({
    queryKey: SHARED_TEAMMATES_QUERY_KEYS.tags,
    queryFn: () => apiService.getSharedTags(),
    enabled,
    staleTime: CATALOGUE_STALE_TIME,
  });

  return {
    categories: categoriesQuery.data ?? [],
    tags: tagsQuery.data ?? [],
  };
}

export function useSharedTeammates(filters?: SharedTeammateFilterInput, enabled = true) {
  const queryClient = useQueryClient();
  const { categories, tags } = useSharedTeammateCategories(enabled);

  const { data: sharedAgents = [], isLoading: isLoadingSharedTeammates } = useQuery<
    SharedTeammateSummary[]
  >({
    queryKey: [...SHARED_TEAMMATES_QUERY_KEYS.all, filters],
    queryFn: () => apiService.listSharedTeammates(filters),
    enabled,
    staleTime: MARKETPLACE_STALE_TIME,
  });

  const { data: featuredTeammates = [], isLoading: isLoadingFeaturedTeammates } = useQuery<
    SharedTeammateSummary[]
  >({
    queryKey: SHARED_TEAMMATES_QUERY_KEYS.featured,
    queryFn: () => apiService.listFeaturedSharedTeammates(filters?.limit),
    enabled,
    staleTime: MARKETPLACE_STALE_TIME,
  });

  const installMutation = useMutation<unknown, Error, string>({
    mutationFn: (sharedTeammateId) => apiService.installSharedTeammate(sharedTeammateId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: TEAMMATES_QUERY_KEYS.all }),
        queryClient.invalidateQueries({ queryKey: capabilityCatalogQueryKey() }),
        queryClient.invalidateQueries({ queryKey: SHARED_TEAMMATES_QUERY_KEYS.all }),
      ]);
      toast.success("Agent installed");
    },
    onError: (error) => {
      toast.error(`Failed to install agent: ${error.message}`);
    },
  });

  return {
    sharedAgents,
    isLoadingSharedTeammates,
    featuredTeammates,
    isLoadingFeaturedTeammates,
    installSharedTeammate: installMutation.mutateAsync,
    isInstalling: installMutation.isPending,
    categories,
    tags,
  };
}

export interface ShareTeammateInput {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
}

export function useTeammateSharing(teammateId: string | null) {
  const queryClient = useQueryClient();
  const { categories } = useSharedTeammateCategories(teammateId !== null);

  const listingQuery = useQuery<SharedTeammateSummary | null>({
    queryKey: SHARED_TEAMMATES_QUERY_KEYS.listing(teammateId ?? ""),
    queryFn: () => apiService.getSharedTeammateListingForTeammate(teammateId ?? ""),
    enabled: teammateId !== null,
    staleTime: MARKETPLACE_STALE_TIME,
  });

  const refreshMarketplace = async () => {
    await queryClient.invalidateQueries({ queryKey: SHARED_TEAMMATES_QUERY_KEYS.all });
  };

  const shareMutation = useMutation<unknown, Error, ShareTeammateInput>({
    mutationFn: ({ name, description, category, tags }) => {
      if (!teammateId) {
        throw new Error("No agent selected to share");
      }

      return apiService.shareTeammate(teammateId, name, description, undefined, category, tags);
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
    mutationFn: (sharedTeammateId) => apiService.unshareTeammate(sharedTeammateId),
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
    isLoadingListing: teammateId !== null && listingQuery.isLoading,
    listingError: listingQuery.error,
    shareTeammate: shareMutation.mutateAsync,
    isSharing: shareMutation.isPending,
    unshareTeammate: unshareMutation.mutateAsync,
    isUnsharing: unshareMutation.isPending,
  };
}
