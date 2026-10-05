import { useCreateOutputShare, useRevokeOutputShare } from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useRef, useState } from "react";

export function useOutputSharing() {
  const [copiedOutputId, setCopiedOutputId] = useState<string | null>(null);
  const [error, setError] = useState<{ outputId: string; message: string } | null>(null);
  const mintedShareTokens = useRef(new Map<string, string>());
  const create = useCreateOutputShare();
  const revoke = useRevokeOutputShare();
  const copy = async (outputId: string) => {
    setError(null);
    try {
      let token = mintedShareTokens.current.get(outputId);

      if (!token) {
        ({ token } = await create.mutateAsync({ outputId }));
        mintedShareTokens.current.set(outputId, token);
      }

      await navigator.clipboard.writeText(`${window.location.origin}/o/${token}`);
      setCopiedOutputId(outputId);
    } catch (failure) {
      setCopiedOutputId(null);
      setError({ outputId, message: getErrorMessage(failure, "Could not copy the share link") });
    }
  };

  const revokeLink = (outputId: string, shareId: string) => {
    mintedShareTokens.current.delete(outputId);
    if (copiedOutputId === outputId) {
      setCopiedOutputId(null);
    }

    revoke.mutate({ outputId, shareId });
  };

  return { create, revoke, copiedOutputId, error, copy, revokeLink };
}
