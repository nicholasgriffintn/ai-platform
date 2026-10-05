import { issueChannelPairingChallenge } from "@ngriffin_uk/polychat-library-client";
import type { ChannelPairingChallenge } from "@ngriffin_uk/polychat-schemas";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function useChannelPairing(bindingId: string) {
  const [challenge, setChallenge] = useState<ChannelPairingChallenge | null>(null);
  const issue = useMutation({
    mutationFn: () => issueChannelPairingChallenge(bindingId),
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
