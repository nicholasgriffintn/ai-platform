import { Button, Input, cn } from "@ngriffin_uk/polychat-component-ui";
import type { RecipeConnectorAccount } from "@ngriffin_uk/polychat-schemas";
import { Check, Pencil, RefreshCw, Save, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  getConnectorAccountLabel,
  isConnectorAccountSelectable,
} from "./connector-account-display";

type ConnectorAccountRowProps = {
  account: RecipeConnectorAccount;
  index: number;
  providerName: string;
  onRename: (accountId: string, alias: string | null) => Promise<void>;
  onSelect: (accountId: string) => Promise<void>;
  isUpdating: boolean;
};

function ConnectorAccountRow({
  account,
  index,
  providerName,
  onRename,
  onSelect,
  isUpdating,
}: ConnectorAccountRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [alias, setAlias] = useState(account.alias ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const label = getConnectorAccountLabel(account, providerName, index);
  const isSelectable = isConnectorAccountSelectable(account);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const cancelEditing = () => {
    setAlias(account.alias ?? "");
    setIsEditing(false);
  };

  const saveAlias = async () => {
    const nextAlias = alias.trim();

    try {
      await onRename(account.id, nextAlias || null);
      setIsEditing(false);
    } catch {
      // Keep the editor open so the user can retry without losing their input.
    }
  };

  return (
    <li
      className={cn(
        "rounded-xl border p-3 transition-colors",
        account.isSelected
          ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/20"
          : "border-zinc-200 bg-white/70 dark:border-zinc-800 dark:bg-zinc-950/30",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
            isSelectable
              ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
          )}
          aria-hidden="true"
        >
          <UserRound className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <label htmlFor={`connector-account-alias-${index}`} className="sr-only">
                Account name
              </label>
              <Input
                ref={inputRef}
                id={`connector-account-alias-${index}`}
                value={alias}
                maxLength={80}
                placeholder={label}
                disabled={isUpdating}
                onChange={(event) => setAlias(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void saveAlias();
                  }

                  if (event.key === "Escape") {
                    cancelEditing();
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  size="xs"
                  onClick={() => void saveAlias()}
                  isLoading={isUpdating}
                  aria-label="Save account name"
                  icon={<Save className="size-3" />}
                >
                  Save
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={isUpdating}
                  onClick={cancelEditing}
                  icon={<X className="size-3" />}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {label}
              </span>
              <button
                type="button"
                className="shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                onClick={() => setIsEditing(true)}
                aria-label={`Rename ${label}`}
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
          )}
          {!isEditing && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {account.isSelected && (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-300">
                  <Check className="size-3" /> Selected
                </span>
              )}
              <span
                className={
                  isSelectable
                    ? "text-zinc-500 dark:text-zinc-400"
                    : "font-medium text-amber-700 dark:text-amber-300"
                }
              >
                {isSelectable ? "Ready" : "Needs reconnection"}
              </span>
            </div>
          )}
        </div>
        {!account.isSelected && !isEditing && (
          <Button
            size="xs"
            variant="outline"
            className="shrink-0"
            disabled={!isSelectable || isUpdating}
            isLoading={isUpdating}
            onClick={() => void onSelect(account.id).catch(() => undefined)}
            aria-label={`Use ${label}`}
          >
            Use
          </Button>
        )}
      </div>
    </li>
  );
}

export interface ConnectorAccountsPanelProps {
  accounts: RecipeConnectorAccount[];
  providerName: string;
  isLoading: boolean;
  hasLoadError: boolean;
  /** Set while an account update is in flight, so only that row shows progress. */
  updatingAccountId?: string | null;
  hasUpdateError: boolean;
  onRetry: () => void;
  onRename: (accountId: string, alias: string | null) => Promise<void>;
  onSelect: (accountId: string) => Promise<void>;
}

export function ConnectorAccountsPanel({
  accounts,
  providerName,
  isLoading,
  hasLoadError,
  updatingAccountId,
  hasUpdateError,
  onRetry,
  onRename,
  onSelect,
}: ConnectorAccountsPanelProps) {
  return (
    <section className="w-full text-left" aria-labelledby="connector-accounts-heading">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h3
            id="connector-accounts-heading"
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
          >
            Connected accounts
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Choose which account recipes use by default.
          </p>
        </div>
        {accounts.length > 0 && (
          <span className="shrink-0 font-mono text-[11px] text-zinc-400">
            {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-label="Loading connected accounts">
          <div className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-16 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        </div>
      ) : hasLoadError ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/30">
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Accounts unavailable
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              You can still reconnect or disconnect below.
            </p>
          </div>
          <Button
            size="xs"
            variant="outline"
            onClick={onRetry}
            icon={<RefreshCw className="size-3" />}
          >
            Try again
          </Button>
        </div>
      ) : accounts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 px-3 py-4 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No connected accounts were returned. Reconnect to add one.
        </p>
      ) : (
        <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
          {accounts.map((account, index) => (
            <ConnectorAccountRow
              key={account.id}
              account={account}
              index={index}
              providerName={providerName}
              onRename={onRename}
              onSelect={onSelect}
              isUpdating={updatingAccountId === account.id}
            />
          ))}
        </ul>
      )}
      {hasUpdateError && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
          Could not update that account. Try again.
        </p>
      )}
    </section>
  );
}
