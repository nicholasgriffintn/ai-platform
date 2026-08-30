import {
  DEFAULT_PET_PRESET_SLUG,
  resolvePet,
  type ResolvedPet,
  type UserPet,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthStatus } from "~/hooks/useAuth";
import {
  createUserPet,
  type CreateUserPetInput,
  deleteUserPet,
  fetchUserPets,
  generatePetImage,
} from "~/lib/api/pets";

export const PET_QUERY_KEYS = {
  all: ["user-pets"],
} as const;

export function usePets() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStatus();

  const { data: pets, isLoading } = useQuery<UserPet[]>({
    queryKey: PET_QUERY_KEYS.all,
    queryFn: fetchUserPets,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  const createMutation = useMutation<UserPet, Error, CreateUserPetInput>({
    mutationFn: createUserPet,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PET_QUERY_KEYS.all });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteUserPet,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PET_QUERY_KEYS.all });
    },
  });

  const generateMutation = useMutation<string, Error, { prompt: string; name: string }>({
    mutationFn: ({ prompt, name }) => generatePetImage(prompt, name),
  });

  return {
    pets: pets ?? [],
    isLoadingPets: isLoading,
    createPet: createMutation.mutateAsync,
    isCreatingPet: createMutation.isPending,
    deletePet: deleteMutation.mutateAsync,
    isDeletingPet: deleteMutation.isPending,
    generatePet: generateMutation.mutateAsync,
    isGeneratingPet: generateMutation.isPending,
  };
}

export interface ActivePet extends ResolvedPet {
  isReady: boolean;
}

export function useActivePet(): ActivePet {
  const { isAuthenticated, isLoading: isAuthLoading, userSettings } = useAuthStatus();
  const { pets, isLoadingPets } = usePets();

  const resolved = resolvePet(
    {
      pet_source: userSettings?.pet_source ?? "preset",
      pet_id: userSettings?.pet_id ?? DEFAULT_PET_PRESET_SLUG,
    },
    pets,
  );

  const isSelectionReady = !isAuthLoading && (!isAuthenticated || !isLoadingPets);

  return {
    ...resolved,
    isReady: isSelectionReady,
  };
}
