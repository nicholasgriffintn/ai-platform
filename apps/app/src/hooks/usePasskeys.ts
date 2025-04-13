import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "~/constants";
import { authService } from "~/lib/api/auth-service";
import { AUTH_QUERY_KEYS } from "./useAuth";

interface Passkey {
  id: number;
  device_type: string;
  created_at: string;
  backed_up: boolean;
}

interface VerificationResponse {
  verified: boolean;
  user?: {
    id: number;
    email: string;
    name?: string;
    github_username?: string;
    avatar_url?: string;
  };
}

interface DeleteResponse {
  success: boolean;
}

export const usePasskeys = () => {
  const queryClient = useQueryClient();

  const registerPasskeyMutation = useMutation({
    mutationFn: async () => {
      const isAuth = await authService.checkAuthStatus();
      if (!isAuth) {
        throw new Error("User must be authenticated to register a passkey");
      }

      const optionsResponse = await fetch(
        `${API_BASE_URL}/auth/webauthn/registration/options`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );

      if (!optionsResponse.ok) {
        throw new Error("Failed to get registration options");
      }

      const options =
        (await optionsResponse.json()) as PublicKeyCredentialCreationOptionsJSON;

      const attestationResponse = await startRegistration({
        optionsJSON: options,
      });

      const verificationResponse = await fetch(
        `${API_BASE_URL}/auth/webauthn/registration/verification`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            response: attestationResponse,
          }),
        },
      );

      if (!verificationResponse.ok) {
        throw new Error("Failed to verify passkey registration");
      }

      const verification = (await verificationResponse.json()) as {
        verified: boolean;
      };

      if (verification.verified) {
        void passkeysQuery.refetch();
      }

      return verification.verified;
    },
  });

  const authenticateWithPasskeyMutation = useMutation<
    VerificationResponse,
    Error
  >({
    mutationFn: async () => {
      const optionsResponse = await fetch(
        `${API_BASE_URL}/auth/webauthn/authentication/options`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );

      if (!optionsResponse.ok) {
        throw new Error("Failed to get authentication options");
      }

      const options =
        (await optionsResponse.json()) as PublicKeyCredentialRequestOptionsJSON;

      const assertionResponse = await startAuthentication({
        optionsJSON: options,
      });

      const verificationResponse = await fetch(
        `${API_BASE_URL}/auth/webauthn/authentication/verification`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            response: assertionResponse,
          }),
        },
      );

      if (!verificationResponse.ok) {
        throw new Error("Failed to verify passkey authentication");
      }

      const verification =
        (await verificationResponse.json()) as VerificationResponse;

      if (verification.verified) {
        await authService.checkAuthStatus();
        await queryClient.invalidateQueries({
          queryKey: AUTH_QUERY_KEYS.authStatus,
        });
      }

      return verification;
    },
  });

  const passkeysQuery = useQuery({
    queryKey: ["passkeys"],
    queryFn: async (): Promise<Passkey[]> => {
      const isAuth = await authService.checkAuthStatus();
      if (!isAuth) {
        return [];
      }

      const response = await fetch(`${API_BASE_URL}/auth/webauthn/passkeys`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch passkeys");
      }

      return response.json();
    },
    enabled: false,
  });

  const deletePasskeyMutation = useMutation({
    mutationFn: async (passkeyId: number) => {
      const response = await fetch(
        `${API_BASE_URL}/auth/webauthn/passkeys/${passkeyId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete passkey");
      }

      const result = (await response.json()) as DeleteResponse;

      if (result.success) {
        void passkeysQuery.refetch();
      }

      return result.success;
    },
  });

  const isPasskeySupported = () => {
    return (
      window.PublicKeyCredential !== undefined &&
      typeof window.PublicKeyCredential === "function" &&
      window.PublicKeyCredential.isConditionalMediationAvailable?.() !==
        undefined
    );
  };

  return {
    registerPasskey: registerPasskeyMutation.mutate,
    isRegisteringPasskey: registerPasskeyMutation.isPending,
    registerPasskeyError: registerPasskeyMutation.error,

    authenticateWithPasskey: authenticateWithPasskeyMutation.mutateAsync,
    isAuthenticatingWithPasskey: authenticateWithPasskeyMutation.isPending,
    authenticateWithPasskeyError: authenticateWithPasskeyMutation.error,

    passkeys: passkeysQuery.data || [],
    fetchPasskeys: passkeysQuery.refetch,
    isLoadingPasskeys: passkeysQuery.isLoading || passkeysQuery.isFetching,
    passkeysError: passkeysQuery.error,

    deletePasskey: deletePasskeyMutation.mutate,
    isDeletingPasskey: deletePasskeyMutation.isPending,
    deletePasskeyError: deletePasskeyMutation.error,

    isPasskeySupported,
  };
};
