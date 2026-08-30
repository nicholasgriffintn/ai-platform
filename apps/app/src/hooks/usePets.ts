import {
  DEFAULT_PET_PRESET_SLUG,
  EMPTY_PET_MODEL_OVERRIDES,
  parsePetModelOverrides,
  resolvePetForModel,
  resolvePetSelectionForModel,
  type ModelConfigItem,
  type ResolvedPet,
  type UserPet,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthStatus } from "~/hooks/useAuth";
import {
  createUserPet,
  type CreateUserPetInput,
  deleteUserPet,
  fetchUserPet,
  fetchUserPets,
  generatePetImage,
} from "~/lib/api/pets";

export const PET_QUERY_KEYS = {
  all: ["user-pets"],
  page: (page: number) => ["user-pets", "page", page] as const,
  detail: (petId: string) => ["user-pets", "detail", petId] as const,
} as const;

export function usePets(page = 1) {
  const queryClient = useQueryClient();
  const { isAuthenticated, refreshAuthStatus } = useAuthStatus();

  const { data, isLoading } = useQuery({
    queryKey: PET_QUERY_KEYS.page(page),
    queryFn: () => fetchUserPets(page),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  const createMutation = useMutation<UserPet, Error, CreateUserPetInput>({
    mutationFn: createUserPet,
    onSuccess: (pet) => {
      queryClient.setQueryData(PET_QUERY_KEYS.detail(pet.id), pet);
      void queryClient.invalidateQueries({ queryKey: PET_QUERY_KEYS.all });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteUserPet,
    onSuccess: async (_, petId) => {
      queryClient.removeQueries({ queryKey: PET_QUERY_KEYS.detail(petId) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PET_QUERY_KEYS.all }),
        refreshAuthStatus(),
      ]);
    },
  });

  const generateMutation = useMutation<string, Error, { prompt: string; name: string }>({
    mutationFn: ({ prompt, name }) => generatePetImage(prompt, name),
  });

  return {
    pets: data?.pets ?? [],
    hasMorePets: data?.has_more ?? false,
    isLoadingPets: isLoading,
    createPet: createMutation.mutateAsync,
    isCreatingPet: createMutation.isPending,
    deletePet: deleteMutation.mutateAsync,
    isDeletingPet: deleteMutation.isPending,
    generatePet: generateMutation.mutateAsync,
    isGeneratingPet: generateMutation.isPending,
  };
}

export function usePet(petId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: PET_QUERY_KEYS.detail(petId ?? ""),
    queryFn: () => fetchUserPet(petId ?? ""),
    enabled: enabled && Boolean(petId),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

export interface ActivePet extends ResolvedPet {
  isReady: boolean;
}

export function useActivePet(
  model?: Pick<ModelConfigItem, "family" | "provider">,
  modelReady = true,
): ActivePet {
  const { isAuthenticated, isLoading: isAuthLoading, userSettings } = useAuthStatus();
  const { pets, isLoadingPets } = usePets(1);

  const selection = {
    pet_source: userSettings?.pet_source ?? "preset",
    pet_id: userSettings?.pet_id ?? DEFAULT_PET_PRESET_SLUG,
  } as const;
  const overrides = parsePetModelOverrides(
    userSettings?.pet_model_overrides ?? EMPTY_PET_MODEL_OVERRIDES,
  );
  const modelSelection = resolvePetSelectionForModel(selection, overrides, model);
  const listedCustomPet =
    modelSelection.pet_source === "custom"
      ? pets.find((pet) => pet.id === modelSelection.pet_id)
      : undefined;
  const needsCustomPet = modelSelection.pet_source === "custom" && !listedCustomPet;
  const { data: fetchedCustomPet, isLoading: isLoadingCustomPet } = usePet(
    modelSelection.pet_id,
    isAuthenticated && needsCustomPet && !isLoadingPets,
  );
  const listedDefaultPet =
    selection.pet_source === "custom" ? pets.find((pet) => pet.id === selection.pet_id) : undefined;
  const needsDefaultPet =
    selection.pet_source === "custom" &&
    selection.pet_id !== modelSelection.pet_id &&
    !listedDefaultPet;
  const { data: fetchedDefaultPet, isLoading: isLoadingDefaultPet } = usePet(
    selection.pet_id,
    isAuthenticated && needsDefaultPet && !isLoadingPets,
  );
  const customPets = [pets, fetchedCustomPet, fetchedDefaultPet]
    .flat()
    .filter((pet): pet is UserPet => Boolean(pet));
  const resolved = resolvePetForModel(selection, overrides, model, customPets);

  const isSelectionReady =
    !isAuthLoading &&
    (!isAuthenticated ||
      (!isLoadingPets &&
        (!needsCustomPet || !isLoadingCustomPet) &&
        (!needsDefaultPet || !isLoadingDefaultPet))) &&
    modelReady;

  return {
    ...resolved,
    isReady: isSelectionReady,
  };
}
