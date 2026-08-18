import { ApiError } from "@ngriffin_uk/polychat-library-client";
import type {
  RecipeConnectorManifest,
  RecipeConnectorProvider,
} from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { RECIPE_CONNECTORS_QUERY_KEY, useStartRecipeConnector } from "~/hooks/useConnectors";
import {
  navigateConnectorAuthPopup,
  openConnectorAuthPopup,
  waitForConnectorAuthPopup,
} from "~/lib/connector-auth-popup";

interface ApiKeyDialogState {
  open: boolean;
  providerId: RecipeConnectorProvider | null;
  providerName: string;
  credentialLabel?: string;
}

type AuthConfig = NonNullable<RecipeConnectorManifest["authConfigs"]>[number];

interface AuthConfigDialogState {
  connector: RecipeConnectorManifest | null;
  configs: AuthConfig[];
}

export interface ConnectorSetupController {
  authConfigDialog: AuthConfigDialogState;
  apiKeyDialog: ApiKeyDialogState;
  closeApiKeyDialog: (open: boolean) => void;
  closeAuthConfigDialog: (open: boolean) => void;
  connect: (connector: RecipeConnectorManifest) => Promise<void>;
  connectingProviderId: RecipeConnectorProvider | null;
  isStarting: boolean;
  onApiKeyStored: () => Promise<void>;
  selectAuthConfig: (authConfigId: string) => void;
}

const CLOSED_API_KEY_DIALOG: ApiKeyDialogState = {
  open: false,
  providerId: null,
  providerName: "",
};

export function useConnectorSetup({
  onConnected,
  returnTo = "/profile?tab=providers&type=connector",
}: {
  onConnected?: (provider: RecipeConnectorProvider) => Promise<void> | void;
  returnTo?: string;
} = {}): ConnectorSetupController {
  const queryClient = useQueryClient();
  const startConnector = useStartRecipeConnector();
  const [apiKeyDialog, setApiKeyDialog] = useState<ApiKeyDialogState>(CLOSED_API_KEY_DIALOG);
  const [authConfigDialog, setAuthConfigDialog] = useState<AuthConfigDialogState>({
    connector: null,
    configs: [],
  });
  const [connectingProviderId, setConnectingProviderId] = useState<RecipeConnectorProvider | null>(
    null,
  );
  const popupRef = useRef<Window | null>(null);
  const popupAbortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      popupAbortRef.current?.abort();
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    },
    [],
  );

  const refreshConnection = async (provider: RecipeConnectorProvider) => {
    await queryClient.invalidateQueries({ queryKey: RECIPE_CONNECTORS_QUERY_KEY });
    await onConnected?.(provider);
  };

  const startComposioConnector = async (
    connector: RecipeConnectorManifest,
    authConfigId?: string,
  ) => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
      toast.info("Finish the current connector setup before starting another.");

      return;
    }

    const popup = openConnectorAuthPopup();

    if (!popup) {
      toast.error("Allow popups for Polychat to connect this provider.");

      return;
    }

    const abortController = new AbortController();

    popupRef.current = popup;
    popupAbortRef.current = abortController;
    setConnectingProviderId(connector.id);
    const toastId = toast.loading(`Waiting for ${connector.name}`, {
      description: "Complete the connection in the popup window.",
    });

    try {
      const completion = waitForConnectorAuthPopup({
        popup,
        provider: connector.id,
        signal: abortController.signal,
      });
      const response = await startConnector.mutateAsync({
        provider: connector.id,
        authConfigId,
        returnTo,
      });

      if (!popup.closed) {
        navigateConnectorAuthPopup(popup, response.authorizationUrl);
      }

      const outcome = await completion;

      if (outcome === "aborted") {
        toast.dismiss(toastId);

        return;
      }

      if (outcome === "connected") {
        await refreshConnection(connector.id);
        toast.success(`${connector.name} connected`, { id: toastId });

        return;
      }

      toast.error(
        outcome === "timed_out"
          ? `${connector.name} connection timed out.`
          : `${connector.name} connection window was closed.`,
        { id: toastId },
      );
    } catch (error) {
      abortController.abort();
      if (!popup.closed) {
        popup.close();
      }

      console.error(error);
      toast.error(error instanceof ApiError ? error.message : "Could not start connector setup.", {
        id: toastId,
      });
    } finally {
      if (popupRef.current === popup) {
        popupRef.current = null;
      }

      if (popupAbortRef.current === abortController) {
        popupAbortRef.current = null;
      }

      setConnectingProviderId(null);
    }
  };

  const connect = async (connector: RecipeConnectorManifest) => {
    if (connector.status === "unconfigured") {
      toast.error(`${connector.name} is not configured for this deployment.`);

      return;
    }

    if (connector.authType === "api_key") {
      setApiKeyDialog({
        open: true,
        providerId: connector.id,
        providerName: connector.name,
        credentialLabel: connector.credentialLabel,
      });

      return;
    }

    const configs = connector.authConfigs ?? [];

    if (configs.length > 1) {
      setAuthConfigDialog({ connector, configs });

      return;
    }

    await startComposioConnector(connector, configs[0]?.id);
  };

  const selectAuthConfig = (authConfigId: string) => {
    const connector = authConfigDialog.connector;

    setAuthConfigDialog({ connector: null, configs: [] });
    if (connector) {
      void startComposioConnector(connector, authConfigId);
    }
  };

  return {
    authConfigDialog,
    apiKeyDialog,
    closeApiKeyDialog: (open) => setApiKeyDialog(open ? apiKeyDialog : CLOSED_API_KEY_DIALOG),
    closeAuthConfigDialog: (open) => {
      if (!open) {
        setAuthConfigDialog({ connector: null, configs: [] });
      }
    },
    connect,
    connectingProviderId,
    isStarting: startConnector.isPending,
    onApiKeyStored: async () => {
      const provider = apiKeyDialog.providerId;

      if (provider) {
        await refreshConnection(provider);
      }
    },
    selectAuthConfig,
  };
}
