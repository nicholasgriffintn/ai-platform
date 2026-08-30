import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from "@ngriffin_uk/polychat-component-ui";
import { FingerprintIcon, KeyRoundIcon, LifeBuoyIcon } from "lucide-react";
import { useState } from "react";

export type UnlockMethod = "passkey" | "password" | "recovery";

export interface UnlockConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableMethods: readonly UnlockMethod[];
  isSubmitting: boolean;
  error?: string | null;
  onUnlockWithPasskey: () => void;
  onUnlockWithPassword: (password: string) => void;
  onUnlockWithRecoveryKey: (recoveryKey: string) => void;
}

function SecretForm({
  label,
  placeholder,
  isSubmitting,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  isSubmitting: boolean;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();

        if (value.trim()) {
          onSubmit(value);
        }
      }}
    >
      <Input
        type={placeholder === "Recovery key" ? "text" : "password"}
        autoComplete={placeholder === "Recovery key" ? "off" : "current-password"}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={!value.trim() || isSubmitting}
        isLoading={isSubmitting}
      >
        {label}
      </Button>
    </form>
  );
}

export function UnlockConversationDialog({
  open,
  onOpenChange,
  availableMethods,
  isSubmitting,
  error,
  onUnlockWithPasskey,
  onUnlockWithPassword,
  onUnlockWithRecoveryKey,
}: UnlockConversationDialogProps) {
  const [method, setMethod] = useState<UnlockMethod>(
    availableMethods.includes("passkey") ? "passkey" : "password",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} width="24rem">
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-center">Unlock this chat</DialogTitle>
          <DialogDescription className="text-center">
            Polychat does not keep a copy of your key.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {method === "passkey" && (
            <Button
              type="button"
              variant="primary"
              className="w-full"
              isLoading={isSubmitting}
              onClick={onUnlockWithPasskey}
            >
              <FingerprintIcon className="size-4" aria-hidden="true" />
              Unlock with passkey
            </Button>
          )}

          {method === "password" && (
            <SecretForm
              label="Unlock"
              placeholder="Password"
              isSubmitting={isSubmitting}
              onSubmit={onUnlockWithPassword}
            />
          )}

          {method === "recovery" && (
            <SecretForm
              label="Unlock with recovery key"
              placeholder="Recovery key"
              isSubmitting={isSubmitting}
              onSubmit={onUnlockWithRecoveryKey}
            />
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex flex-wrap justify-center gap-3 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-800">
            {availableMethods.includes("passkey") && method !== "passkey" && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                onClick={() => setMethod("passkey")}
              >
                <FingerprintIcon className="size-4" aria-hidden="true" />
                Use passkey
              </button>
            )}
            {availableMethods.includes("password") && method !== "password" && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                onClick={() => setMethod("password")}
              >
                <KeyRoundIcon className="size-4" aria-hidden="true" />
                Use password
              </button>
            )}
            {method !== "recovery" && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                onClick={() => setMethod("recovery")}
              >
                <LifeBuoyIcon className="size-4" aria-hidden="true" />
                Use recovery key
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
