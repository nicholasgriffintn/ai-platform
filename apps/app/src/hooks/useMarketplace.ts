import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiService } from "~/lib/api/api-service";
import type { MarketplaceAgent, MarketplaceFilters } from "~/types";

export const MARKETPLACE_QUERY_KEYS = {
  all: ["marketplace"],
  agents: (filters?: MarketplaceFilters) => [
    ...MARKETPLACE_QUERY_KEYS.all,
    "agents",
    filters,
  ],
  agent: (id: string) => [...MARKETPLACE_QUERY_KEYS.all, "agent", id],
  featured: () => [...MARKETPLACE_QUERY_KEYS.all, "featured"],
  categories: () => [...MARKETPLACE_QUERY_KEYS.all, "categories"],
  tags: () => [...MARKETPLACE_QUERY_KEYS.all, "tags"],
  stats: () => [...MARKETPLACE_QUERY_KEYS.all, "stats"],
} as const;

export function useMarketplace(filters?: MarketplaceFilters) {
  const queryClient = useQueryClient();

  const {
    data: agents = [],
    isLoading: isLoadingAgents,
    error: errorAgents,
  } = useQuery<MarketplaceAgent[]>({
    queryKey: MARKETPLACE_QUERY_KEYS.agents(filters),
    queryFn: () => apiService.listMarketplaceAgents(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const {
    data: featuredAgents = [],
    isLoading: isLoadingFeatured,
    error: errorFeatured,
  } = useQuery<MarketplaceAgent[]>({
    queryKey: MARKETPLACE_QUERY_KEYS.featured(),
    queryFn: () => apiService.getFeaturedAgents(),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<
    string[]
  >({
    queryKey: MARKETPLACE_QUERY_KEYS.categories(),
    queryFn: () => apiService.getMarketplaceCategories(),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const { data: tags = [], isLoading: isLoadingTags } = useQuery<string[]>({
    queryKey: MARKETPLACE_QUERY_KEYS.tags(),
    queryFn: () => apiService.getMarketplaceTags(),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const installMutation = useMutation<any, Error, string>({
    mutationFn: (agentId) => apiService.installMarketplaceAgent(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MARKETPLACE_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const shareMutation = useMutation<
    MarketplaceAgent,
    Error,
    {
      agentId: string;
      data: {
        name: string;
        description?: string;
        category?: string;
        tags?: string[];
      };
    }
  >({
    mutationFn: ({ agentId, data }) => apiService.shareAgent(agentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MARKETPLACE_QUERY_KEYS.all });
    },
  });

  const rateMutation = useMutation<
    void,
    Error,
    { agentId: string; rating: number; review?: string }
  >({
    mutationFn: ({ agentId, rating, review }) =>
      apiService.rateAgent(agentId, rating, review),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MARKETPLACE_QUERY_KEYS.all });
    },
  });

  return {
    agents,
    featuredAgents,
    categories,
    tags,
    isLoadingAgents,
    isLoadingFeatured,
    isLoadingCategories,
    isLoadingTags,
    errorAgents,
    errorFeatured,
    installAgent: installMutation.mutateAsync,
    isInstallingAgent: installMutation.isPending,
    shareAgent: shareMutation.mutateAsync,
    isSharingAgent: shareMutation.isPending,
    rateAgent: rateMutation.mutateAsync,
    isRatingAgent: rateMutation.isPending,
  };
}

export function useMarketplaceAgent(agentId: string) {
  return useQuery<MarketplaceAgent>({
    queryKey: MARKETPLACE_QUERY_KEYS.agent(agentId),
    queryFn: () => apiService.getMarketplaceAgent(agentId),
    enabled: !!agentId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
