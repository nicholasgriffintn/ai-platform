import {
  createRecipeWebhookTrigger,
  deleteRecipeWebhookTrigger,
  listRecipeWebhookTriggers,
  rotateRecipeWebhookTrigger,
  updateRecipeWebhookTrigger,
} from "@ngriffin_uk/polychat-library-client";
import type { RecipeWebhookTriggerCreateRequest } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const recipeWebhookTriggersQueryKey = (installationId: string) =>
  ["recipe-webhook-triggers", installationId] as const;

export function useRecipeWebhookTriggers(installationId: string) {
  const queryClient = useQueryClient();
  const triggers = useQuery({
    queryKey: recipeWebhookTriggersQueryKey(installationId),
    queryFn: () => listRecipeWebhookTriggers(installationId),
  });
  const refreshTriggers = () =>
    queryClient.invalidateQueries({ queryKey: recipeWebhookTriggersQueryKey(installationId) });
  const createTrigger = useMutation({
    mutationFn: (input: RecipeWebhookTriggerCreateRequest) =>
      createRecipeWebhookTrigger(installationId, input),
    onSuccess: refreshTriggers,
  });
  const updateTrigger = useMutation({
    mutationFn: ({ triggerId, status }: { triggerId: string; status: "active" | "paused" }) =>
      updateRecipeWebhookTrigger(triggerId, status),
    onSuccess: refreshTriggers,
  });
  const rotateTrigger = useMutation({
    mutationFn: rotateRecipeWebhookTrigger,
    onSuccess: refreshTriggers,
  });
  const deleteTrigger = useMutation({
    mutationFn: deleteRecipeWebhookTrigger,
    onSuccess: refreshTriggers,
  });

  return { triggers, createTrigger, updateTrigger, rotateTrigger, deleteTrigger };
}
