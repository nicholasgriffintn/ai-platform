import {
  LockConversationDialog,
  UnlockConversationDialog,
  type LockConversationStep,
  type UnlockMethod,
} from "@ngriffin_uk/polychat-component-conversation";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import { LockIcon, LockOpenIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useChat } from "~/hooks/useChat";
import {
  isConversationLocked,
  useConversationLock,
  useConversationLockState,
  useLockConversation,
  useRemoveConversationLock,
  useUnlockConversation,
} from "~/hooks/useConversationLock";
import { isPasskeyEncryptionSupported } from "~/lib/crypto/conversation-lock";
import { useChatStore } from "~/state/stores/chatStore";
import { useConversationLockStore } from "~/state/stores/conversationLockStore";

interface ConversationLockControlsProps {
  conversationId: string;
}

function readErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function ConversationLockControls({ conversationId }: ConversationLockControlsProps) {
  const { isAuthenticated, isPro } = useChatStore();
  const { data: conversation } = useChat(conversationId);
  const isLocked = isConversationLocked(conversation);
  const { isUnlocked } = useConversationLockState(conversationId);

  const { data: lock } = useConversationLock(conversationId, isLocked);
  const lockConversation = useLockConversation();
  const unlockConversation = useUnlockConversation();
  const removeLock = useRemoveConversationLock();

  const [isLockDialogOpen, setIsLockDialogOpen] = useState(false);
  const [isUnlockDialogOpen, setIsUnlockDialogOpen] = useState(false);
  const [step, setStep] = useState<LockConversationStep>("intro");
  const [error, setError] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);

  const messages = useMemo(() => conversation?.messages ?? [], [conversation?.messages]);

  const unlockRequestedFor = useConversationLockStore((state) => state.unlockRequestedFor);
  const clearUnlockRequest = useConversationLockStore((state) => state.clearUnlockRequest);

  useEffect(() => {
    if (unlockRequestedFor === conversationId) {
      setError(null);
      setIsUnlockDialogOpen(true);
      clearUnlockRequest();
    }
  }, [clearUnlockRequest, conversationId, unlockRequestedFor]);

  const availableMethods = useMemo<UnlockMethod[]>(() => {
    const methods = new Set<UnlockMethod>();

    for (const key of lock?.keys ?? []) {
      methods.add(key.type);
    }

    return [...methods];
  }, [lock?.keys]);

  const runLock = useCallback(
    async (method: Parameters<typeof lockConversation.mutateAsync>[0]["method"]) => {
      setError(null);

      try {
        const result = await lockConversation.mutateAsync({
          conversationId,
          method,
          messages,
          title: conversation?.title ?? null,
        });

        setRecoveryKey(result.recoveryKey);
        setStep("recovery");
      } catch (lockError) {
        setError(readErrorMessage(lockError, "This chat could not be locked."));
      }
    },
    [conversation?.title, conversationId, lockConversation, messages],
  );

  const runUnlock = useCallback(
    async (attempt: Parameters<typeof unlockConversation.mutateAsync>[0]["attempt"]) => {
      if (!lock) {
        return;
      }

      setError(null);

      try {
        await unlockConversation.mutateAsync({ lock, attempt });
        setIsUnlockDialogOpen(false);
      } catch (unlockError) {
        setError(readErrorMessage(unlockError, "That did not open this chat."));
      }
    },
    [lock, unlockConversation],
  );

  const handleRemoveLock = useCallback(async () => {
    try {
      await removeLock.mutateAsync({
        conversationId,
        messages,
        title: conversation?.title ?? null,
      });
      toast.success("This chat is no longer locked.");
    } catch (removeError) {
      setError(readErrorMessage(removeError, "This chat could not be unlocked."));
      toast.error("This chat could not be unlocked.");
    }
  }, [conversation?.title, conversationId, messages, removeLock]);

  if (!isAuthenticated || !isPro || conversation?.project_id) {
    return null;
  }

  if (!isLocked) {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          className="shrink-0"
          aria-label="Lock this chat"
          onClick={() => {
            setStep("intro");
            setError(null);
            setIsLockDialogOpen(true);
          }}
        >
          <LockIcon className="size-4" aria-hidden="true" />
        </Button>

        <LockConversationDialog
          open={isLockDialogOpen}
          onOpenChange={(open) => {
            setIsLockDialogOpen(open);

            if (!open) {
              setRecoveryKey(null);
              setStep("intro");
            }
          }}
          step={step}
          onStepChange={setStep}
          hasExistingMessages={messages.length > 0}
          isPasskeySupported={isPasskeyEncryptionSupported()}
          isSubmitting={lockConversation.isPending}
          error={error}
          recoveryKey={recoveryKey}
          onLockWithPasskey={() => void runLock({ type: "passkey" })}
          onLockWithPassword={(password) => void runLock({ type: "password", password })}
          onRecoveryKeyAcknowledged={() => {
            setRecoveryKey(null);
            setIsLockDialogOpen(false);
            setStep("intro");
          }}
        />
      </>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="shrink-0"
        aria-label={isUnlocked ? "Remove the lock on this chat" : "Unlock this chat"}
        isLoading={removeLock.isPending}
        onClick={() => {
          if (isUnlocked) {
            void handleRemoveLock();

            return;
          }

          setError(null);
          setIsUnlockDialogOpen(true);
        }}
      >
        {isUnlocked ? (
          <LockOpenIcon className="size-4" aria-hidden="true" />
        ) : (
          <LockIcon className="size-4" aria-hidden="true" />
        )}
      </Button>

      <UnlockConversationDialog
        open={isUnlockDialogOpen}
        onOpenChange={setIsUnlockDialogOpen}
        availableMethods={availableMethods}
        isSubmitting={unlockConversation.isPending}
        error={error}
        onUnlockWithPasskey={() => void runUnlock({ type: "passkey" })}
        onUnlockWithPassword={(password) => void runUnlock({ type: "password", password })}
        onUnlockWithRecoveryKey={(key) => void runUnlock({ type: "recovery", recoveryKey: key })}
      />
    </>
  );
}
