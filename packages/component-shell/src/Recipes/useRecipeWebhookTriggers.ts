import {
  createRecipeWebhookTrigger,
  deleteInstallationTrigger,
  listRecipeWebhookTriggers,
  rotateRecipeWebhookTrigger,
  updateRecipeWebhookTriggerStatus,
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
      updateRecipeWebhookTriggerStatus(installationId, triggerId, status),
    onSuccess: refreshTriggers,
  });
  const rotateTrigger = useMutation({
    mutationFn: (triggerId: string) => rotateRecipeWebhookTrigger(installationId, triggerId),
    onSuccess: refreshTriggers,
  });
  const deleteTrigger = useMutation({
    mutationFn: (triggerId: string) => deleteInstallationTrigger(installationId, triggerId),
    onSuccess: refreshTriggers,
  });

  return { triggers, createTrigger, updateTrigger, rotateTrigger, deleteTrigger };
}
