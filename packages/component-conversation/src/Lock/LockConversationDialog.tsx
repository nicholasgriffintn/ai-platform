import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from "@ngriffin_uk/polychat-component-ui";
import {
  EyeIcon,
  EyeOffIcon,
  FingerprintIcon,
  KeyRoundIcon,
  LockIcon,
  ShieldIcon,
  TriangleAlertIcon,
  WifiOffIcon,
} from "lucide-react";
import { useState } from "react";

export type LockConversationStep = "intro" | "passkey" | "password" | "recovery";

export interface LockConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: LockConversationStep;
  onStepChange: (step: LockConversationStep) => void;
  hasExistingMessages: boolean;
  isPasskeySupported: boolean;
  isSubmitting: boolean;
  error?: string | null;
  recoveryKey?: string | null;
  onLockWithPasskey: () => void;
  onLockWithPassword: (password: string) => void;
  onRecoveryKeyAcknowledged: () => void;
}

const MINIMUM_PASSWORD_LENGTH = 12;

function TermRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span className="space-y-0.5">
        <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</span>
        <span className="block text-sm text-zinc-500 dark:text-zinc-400">{description}</span>
      </span>
    </li>
  );
}

function IntroStep({
  hasExistingMessages,
  isPasskeySupported,
  onStepChange,
}: Pick<LockConversationDialogProps, "hasExistingMessages" | "isPasskeySupported"> & {
  onStepChange: (step: LockConversationStep) => void;
}) {
  return (
    <div className="space-y-5">
      <ul className="space-y-4">
        <TermRow
          icon={<ShieldIcon className="size-5 text-emerald-600 dark:text-emerald-400" />}
          title="Polychat cannot read it"
          description="Your device encrypts each message before it is stored."
        />
        <TermRow
          icon={<WifiOffIcon className="size-5 text-sky-600 dark:text-sky-400" />}
          title="The model still can"
          description="Your messages are sent to the model in the clear so it can answer."
        />
        <TermRow
          icon={<TriangleAlertIcon className="size-5 text-amber-600 dark:text-amber-400" />}
          title="There is no reset"
          description="Polychat gives you a recovery key. Lose all of them and the chat is gone."
        />
      </ul>

      <p className="rounded-md bg-off-white-highlight px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        A locked chat has no search, tools, documents, images, or memory. You cannot share it, and
        replies stop if you close this tab.
      </p>

      {hasExistingMessages && (
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
          Locking deletes the files, documents, and stored copies of this chat. That cannot be
          undone.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="primary"
          disabled={!isPasskeySupported}
          onClick={() => onStepChange("passkey")}
        >
          <FingerprintIcon className="size-4" aria-hidden="true" />
          Lock with a passkey
        </Button>
        <Button type="button" variant="secondary" onClick={() => onStepChange("password")}>
          <KeyRoundIcon className="size-4" aria-hidden="true" />
          Use a password instead
        </Button>
      </div>
    </div>
  );
}

function PasskeyStep({
  error,
  isSubmitting,
  onLockWithPasskey,
}: Pick<LockConversationDialogProps, "error" | "isSubmitting" | "onLockWithPasskey">) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Your passkey produces the key that opens this chat. It never leaves your device, and
        Polychat never sees it.
      </p>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <Button
        type="button"
        variant="primary"
        className="w-full"
        isLoading={isSubmitting}
        onClick={onLockWithPasskey}
      >
        Continue with passkey
      </Button>
    </div>
  );
}

function PasswordStep({
  error,
  isSubmitting,
  onLockWithPassword,
}: Pick<LockConversationDialogProps, "error" | "isSubmitting" | "onLockWithPassword">) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isRevealed, setIsRevealed] = useState(false);

  const isTooShort = password.length > 0 && password.length < MINIMUM_PASSWORD_LENGTH;
  const doesNotMatch = confirmation.length > 0 && confirmation !== password;
  const canSubmit =
    password.length >= MINIMUM_PASSWORD_LENGTH && confirmation === password && !isSubmitting;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (canSubmit) {
          onLockWithPassword(password);
        }
      }}
    >
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        This password opens the chat. Polychat does not store it, so it cannot be reset.
      </p>

      <div className="space-y-2">
        <div className="relative">
          <Input
            type={isRevealed ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-2 flex items-center text-zinc-500"
            aria-label={isRevealed ? "Hide password" : "Show password"}
            onClick={() => setIsRevealed((current) => !current)}
          >
            {isRevealed ? (
              <EyeOffIcon className="size-4" aria-hidden="true" />
            ) : (
              <EyeIcon className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        <Input
          type={isRevealed ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Enter the password again"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </div>

      {isTooShort && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Use at least {MINIMUM_PASSWORD_LENGTH} characters. A short sentence beats a complex word.
        </p>
      )}
      {doesNotMatch && (
        <p className="text-sm text-red-600 dark:text-red-400">Those passwords do not match.</p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={!canSubmit}
        isLoading={isSubmitting}
      >
        Lock this chat
      </Button>
    </form>
  );
}

function RecoveryStep({
  recoveryKey,
  onRecoveryKeyAcknowledged,
}: Pick<LockConversationDialogProps, "recoveryKey" | "onRecoveryKeyAcknowledged">) {
  const [isAcknowledged, setIsAcknowledged] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        This is the only way back in if you lose your passkey or forget your password. It is shown
        once.
      </p>
      <p className="rounded-md bg-off-white-highlight px-3 py-3 text-center font-mono text-sm tracking-wider text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
        {recoveryKey}
      </p>
      <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
        <input
          type="checkbox"
          className="mt-1"
          checked={isAcknowledged}
          onChange={(event) => setIsAcknowledged(event.target.checked)}
        />
        I have saved this recovery key somewhere safe.
      </label>
      <Button
        type="button"
        variant="primary"
        className="w-full"
        disabled={!isAcknowledged}
        onClick={onRecoveryKeyAcknowledged}
      >
        Done
      </Button>
    </div>
  );
}

const STEP_COPY: Record<LockConversationStep, { title: string; description: string }> = {
  intro: {
    title: "Lock this chat",
    description: "Your key encrypts this chat.",
  },
  passkey: {
    title: "Use your passkey",
    description: "Confirm with the passkey on this device.",
  },
  password: {
    title: "Set a password",
    description: "This password opens the chat.",
  },
  recovery: {
    title: "Save your recovery key",
    description: "You will not see this again.",
  },
};

export function LockConversationDialog(props: LockConversationDialogProps) {
  const { open, onOpenChange, step } = props;
  const copy = STEP_COPY[step];

  return (
    <Dialog open={open} onOpenChange={onOpenChange} width="26rem">
      <DialogContent>
        <DialogHeader>
          <div className="flex justify-center pb-1">
            <LockIcon className="size-6" aria-hidden="true" />
          </div>
          <DialogTitle className="text-center">{copy.title}</DialogTitle>
          <DialogDescription className="text-center">{copy.description}</DialogDescription>
        </DialogHeader>

        {step === "intro" && (
          <IntroStep
            hasExistingMessages={props.hasExistingMessages}
            isPasskeySupported={props.isPasskeySupported}
            onStepChange={props.onStepChange}
          />
        )}
        {step === "passkey" && (
          <PasskeyStep
            error={props.error}
            isSubmitting={props.isSubmitting}
            onLockWithPasskey={props.onLockWithPasskey}
          />
        )}
        {step === "password" && (
          <PasswordStep
            error={props.error}
            isSubmitting={props.isSubmitting}
            onLockWithPassword={props.onLockWithPassword}
          />
        )}
        {step === "recovery" && (
          <RecoveryStep
            recoveryKey={props.recoveryKey}
            onRecoveryKeyAcknowledged={props.onRecoveryKeyAcknowledged}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
