import {
  createChannelBinding,
  deleteChannelBinding,
  issueChannelPairingChallenge,
  listChannelBindings,
  listChannelSenders,
  revokeChannelSender,
} from "@ngriffin_uk/polychat-library-client";
import type { ChannelPairingChallenge } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useAuthStatus } from "./useAuth.js";

export function useChannelBindings(projectId?: string) {
  const { user, isAuthenticated } = useAuthStatus();
  const client = useQueryClient();
  const key = ["channel-bindings", user?.id];
  const bindings = useQuery({
    queryKey: key,
    queryFn: listChannelBindings,
    enabled: isAuthenticated,
  });
  const create = useMutation({
    mutationFn: createChannelBinding,
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  const disconnect = useMutation({
    mutationFn: deleteChannelBinding,
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });

  return {
    bindings,
    create,
    disconnect,
    visibleBindings:
      bindings.data?.bindings.filter((binding) =>
        projectId
          ? binding.scopeType === "project" && binding.scopeId === projectId
          : binding.scopeType === "personal",
      ) ?? [],
  };
}

export function useChannelSenders(bindingId: string, linking = false) {
  const { user, isAuthenticated } = useAuthStatus();
  const client = useQueryClient();
  const key = ["channel-senders", user?.id, bindingId];
  const senders = useQuery({
    queryKey: key,
    queryFn: () => listChannelSenders(bindingId),
    enabled: isAuthenticated,
    refetchInterval: linking ? 5000 : false,
  });
  const revoke = useMutation({
    mutationFn: (input: { id: string; revision: number }) =>
      revokeChannelSender(bindingId, input.id, input.revision),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });

  return { senders, revoke };
}

export function useChannelPairing(bindingId: string) {
  const [challenge, setChallenge] = useState<ChannelPairingChallenge | null>(null);
  const issue = useMutation({
    mutationFn: () => issueChannelPairingChallenge(bindingId),
    gcTime: 0,
    onSuccess: setChallenge,
  });

  useEffect(() => {
    if (!challenge) {
      return undefined;
    }

    const timer = setTimeout(
      () => setChallenge(null),
      Math.max(0, new Date(challenge.expiresAt).getTime() - Date.now()),
    );

    return () => clearTimeout(timer);
  }, [challenge]);

  return { challenge, issue };
}
