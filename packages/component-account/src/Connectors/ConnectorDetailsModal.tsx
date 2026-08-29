import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import type { RecipeConnectorManifest } from "@ngriffin_uk/polychat-schemas";
import { ExternalLink, KeyRound, Loader2, Plug, Trash2, Wrench } from "lucide-react";
import type { ReactNode } from "react";

import { ConnectorLogo } from "./ConnectorLogo";

export interface ConnectorDetailsModalProps {
  connector: RecipeConnectorManifest | null;
  onOpenChange: (open: boolean) => void;
  onConnect: (connector: RecipeConnectorManifest) => void;
  onDisconnect: (connector: RecipeConnectorManifest) => void;
  isStarting: boolean;
  isDisconnecting: boolean;
  accountsSlot?: ReactNode;
}

export function ConnectorDetailsModal({
  connector,
  onOpenChange,
  onConnect,
  onDisconnect,
  isStarting,
  isDisconnecting,
  accountsSlot,
}: ConnectorDetailsModalProps) {
  if (!connector) {
    return null;
  }

  const isConnected = connector.status === "connected";
  const isUnavailable = connector.status === "unconfigured";
  const authLabel = connector.authConfigs?.[0]?.authScheme ?? "API key";

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <div className="flex flex-col items-center px-2 pb-2 pt-4 text-center">
          <ConnectorLogo connector={connector} className="size-20 rounded-2xl [&_img]:size-12" />
          <DialogTitle className="mt-5 text-2xl">{connector.name}</DialogTitle>
          <DialogDescription className="mt-1">
            {connector.authType === "composio"
              ? "Connected securely by Composio"
              : "Managed by Polychat"}
          </DialogDescription>
          <p className="mt-5 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {connector.description}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 dark:border-zinc-700">
              <Wrench className="size-3.5" /> {connector.toolCount} tools
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 dark:border-zinc-700">
              <KeyRound className="size-3.5" /> {authLabel.replaceAll("_", " ")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 dark:border-zinc-700">
              <span
                className={
                  isConnected
                    ? "size-2 rounded-full bg-emerald-500"
                    : "size-2 rounded-full bg-zinc-400"
                }
              />
              {isConnected ? "Connected" : "Not connected"}
            </span>
          </div>

          {isConnected && connector.authType === "composio" && accountsSlot && (
            <div className="mt-7 w-full border-t border-zinc-200 pt-5 dark:border-zinc-800">
              {accountsSlot}
            </div>
          )}

          <div className="mt-6 flex w-full flex-col gap-2">
            <Button
              className="w-full"
              disabled={isUnavailable || isStarting}
              onClick={() => onConnect(connector)}
            >
              {isStarting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Plug className="mr-2 size-4" />
              )}
              {isConnected ? "Reconnect" : isUnavailable ? "Unavailable" : "Connect"}
            </Button>
            {isConnected && (
              <Button
                variant="ghost"
                className="w-full text-red-600 hover:text-red-700 dark:text-red-400"
                disabled={isDisconnecting}
                onClick={() => onDisconnect(connector)}
              >
                {isDisconnecting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 size-4" />
                )}
                Disconnect
              </Button>
            )}
          </div>
          {connector.appUrl && (
            <a
              href={connector.appUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Visit {connector.name} <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
