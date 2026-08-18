import {
  completeBrowserWebAuthn,
  createBrowserAuthTransport,
  isWebAuthnSupported,
} from "@ngriffin_uk/auth-react";
import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import { useMutation, useQuery } from "@tanstack/react-query";

import { API_BASE_URL } from "~/constants";
import { authService } from "~/lib/api/auth-service";
import { fetchApi } from "~/lib/api/fetch-wrapper";

interface Passkey {
  id: number;
  device_type: string;
  created_at: string;
  backed_up: boolean;
}

interface DeleteResponse {
  success: boolean;
}

export const usePasskeys = () => {
  const registerPasskeyMutation = useMutation({
    mutationFn: async () => {
      const result = await completeBrowserWebAuthn(
        createBrowserAuthTransport({ endpoint: `${API_BASE_URL}/auth` }),
        "registration",
      );

      if (result.status !== "authenticated") {
        throw new Error("Passkey registration was not completed.");
      }

      void passkeysQuery.refetch();

      return true;
    },
  });

  const passkeysQuery = useQuery({
    queryKey: ["passkeys"],
    queryFn: async (): Promise<Passkey[]> => {
      const isAuth = await authService.checkAuthStatus();

      if (!isAuth) {
        return [];
      }

      const response = await fetchApi("/auth/webauthn/passkeys", {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch passkeys");
      }

      return returnFetchedData<Passkey[]>(response);
    },
    enabled: false,
  });

  const deletePasskeyMutation = useMutation({
    mutationFn: async (passkeyId: number) => {
      const response = await fetchApi(`/auth/webauthn/passkeys/${passkeyId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete passkey");
      }

      const result = await returnFetchedData<DeleteResponse>(response);

      if (result.success) {
        void passkeysQuery.refetch();
      }

      return result.success;
    },
  });

  return {
    registerPasskey: registerPasskeyMutation.mutate,
    isRegisteringPasskey: registerPasskeyMutation.isPending,
    registerPasskeyError: registerPasskeyMutation.error,

    passkeys: passkeysQuery.data || [],
    fetchPasskeys: passkeysQuery.refetch,
    isLoadingPasskeys: passkeysQuery.isLoading || passkeysQuery.isFetching,
    passkeysError: passkeysQuery.error,

    deletePasskey: deletePasskeyMutation.mutate,
    isDeletingPasskey: deletePasskeyMutation.isPending,
    deletePasskeyError: deletePasskeyMutation.error,

    isPasskeySupported: isWebAuthnSupported,
  };
};
