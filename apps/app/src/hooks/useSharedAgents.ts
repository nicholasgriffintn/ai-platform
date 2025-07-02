import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiService } from "~/lib/api/api-service";
import { AGENTS_QUERY_KEYS } from "./useAgents";

export const SHARED_AGENTS_QUERY_KEYS = {
  all: ["sharedAgents"],
  featured: ["sharedAgents", "featured"],
  categories: ["sharedAgents", "categories"],
  tags: ["sharedAgents", "tags"],
} as const;

export function useSharedAgents(filters?: {
  category?: string;
  tags?: string[];
  search?: string;
  featured?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: string;
}) {
  const queryClient = useQueryClient();

  const { data: sharedAgents = [], isLoading: isLoadingSharedAgents } =
    useQuery<any[]>({
      queryKey: [...SHARED_AGENTS_QUERY_KEYS.all, filters],
      queryFn: () => apiService.listSharedAgents(filters),
      staleTime: 1000 * 60,
    });

  const { data: featuredAgents = [], isLoading: isLoadingFeaturedAgents } =
    useQuery<any[]>({
      queryKey: SHARED_AGENTS_QUERY_KEYS.featured,
      queryFn: () => apiService.listFeaturedSharedAgents(filters?.limit),
      staleTime: 1000 * 60,
    });

  const installMutation = useMutation<any, Error, string>({
    mutationFn: (agentId) => apiService.installSharedAgent(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEYS.all });
      toast.success("Agent installed successfully");
    },
    onError: (error) => {
      toast.error(`Failed to install agent: ${error.message}`);
    },
  });

  const rateMutation = useMutation<
    any,
    Error,
    { agentId: string; rating: number; review?: string }
  >({
    mutationFn: ({ agentId, rating, review }) =>
      apiService.rateSharedAgent(agentId, rating, review),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHARED_AGENTS_QUERY_KEYS.all });
      toast.success("Rating submitted");
    },
    onError: (error) => {
      toast.error(`Failed to submit rating: ${error.message}`);
    },
  });

  const shareMutation = useMutation<
    any,
    Error,
    {
      agentId: string;
      name: string;
      description?: string;
      avatarUrl?: string;
      category?: string;
      tags?: string[];
    }
  >({
    mutationFn: ({ agentId, name, description, avatarUrl, category, tags }) =>
      apiService.shareAgent(
        agentId,
        name,
        description,
        avatarUrl,
        category,
        tags,
      ),
    onSuccess: () => {
      toast.success("Agent shared successfully");
    },
    onError: (error) => {
      toast.error(`Failed to share agent: ${error.message}`);
    },
  });

  const categoriesQuery = useQuery<string[]>({
    queryKey: SHARED_AGENTS_QUERY_KEYS.categories,
    queryFn: () => apiService.getSharedCategories(),
    staleTime: 1000 * 60 * 60,
  });

  const tagsQuery = useQuery<string[]>({
    queryKey: SHARED_AGENTS_QUERY_KEYS.tags,
    queryFn: () => apiService.getSharedTags(),
    staleTime: 1000 * 60 * 60,
  });

  return {
    sharedAgents,
    isLoadingSharedAgents,
    featuredAgents,
    isLoadingFeaturedAgents,
    installSharedAgent: installMutation.mutateAsync,
    isInstalling: installMutation.isPending,
    rateSharedAgent: rateMutation.mutateAsync,
    isRating: rateMutation.isPending,
    shareAgent: shareMutation.mutateAsync,
    isSharing: shareMutation.isPending,
    categories: categoriesQuery.data || [],
    tags: tagsQuery.data || [],
  };
}
