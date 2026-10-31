import { getFlagBootstrap, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { createBootstrapProvider, type FlagValue } from "@ngriffin_uk/polychat-library-flags";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const FLAG_BOOTSTRAP_QUERY_KEY = "flag-bootstrap";

const FLAG_BOOTSTRAP_STALE_MS = 1000 * 60 * 5;

export function useFlag<T extends FlagValue>(flagKey: string, defaultValue: T): T {
  const queryClient = useQueryClient();
  const identity = useChatStore((state) => state.user?.id ?? "anonymous");
  const { data } = useQuery({
    queryKey: [FLAG_BOOTSTRAP_QUERY_KEY, identity, flagKey],
    queryFn: async () => {
      const bootstrap = await queryClient.fetchQuery({
        queryKey: [FLAG_BOOTSTRAP_QUERY_KEY, identity],
        queryFn: getFlagBootstrap,
        staleTime: FLAG_BOOTSTRAP_STALE_MS,
      });

      return createBootstrapProvider(bootstrap.evaluations).resolve(flagKey, defaultValue, {});
    },
    staleTime: FLAG_BOOTSTRAP_STALE_MS,
  });

  return data?.value ?? defaultValue;
}
