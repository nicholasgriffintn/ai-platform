import {
  ConversationThread,
  useConversationLaunchModeConfig,
} from "@ngriffin_uk/polychat-component-conversation";
import type { ThreadModeConfig } from "@ngriffin_uk/polychat-component-conversation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  createChatWelcome,
  useChats,
  useCancelDelegations,
  useConversationRoute,
} from "@ngriffin_uk/polychat-library-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";

import { DelegatePanel } from "../Delegations/DelegatePanel.js";
import { HomeDiscover } from "../Discover/HomeDiscover.js";

interface HomeConversationThreadProps {
  urlModeConfig?: ThreadModeConfig;
}

export function HomeConversationThread({ urlModeConfig }: HomeConversationThreadProps) {
  const { completionId } = useParams<"completionId">();
  const modeConfig = useConversationLaunchModeConfig(urlModeConfig, completionId);
  const [delegateConversationId, setDelegateConversationId] = useState<string | null>(null);
  const cancelDelegations = useCancelDelegations();

  useConversationRoute({ surface: { kind: "personal" }, pathConversationId: completionId });

  const user = useChatStore((state) => state.user);
  const userSettings = useChatStore((state) => state.userSettings);
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);
  const { data: conversations, isLoading: areConversationsLoading } = useChats();
  const [welcomeSeed, setWelcomeSeed] = useState<number | null>(null);

  useEffect(() => {
    setWelcomeSeed(Math.random());
  }, []);
  const welcome = useMemo(
    () =>
      createChatWelcome(
        {
          preferredName: userSettings?.nickname,
          accountName: user?.name,
          jobRole: userSettings?.job_role,
          hasPreviousChats: Boolean(user?.message_count || conversations.length),
        },
        welcomeSeed ?? 0,
      ),
    [
      conversations.length,
      user?.message_count,
      user?.name,
      userSettings?.job_role,
      userSettings?.nickname,
      welcomeSeed,
    ],
  );
  const hasModeWelcome = Boolean(modeConfig?.welcomeTitle || modeConfig?.welcomeDescription);
  const isWelcomeLoading =
    !hasModeWelcome && (welcomeSeed === null || isAuthenticationLoading || areConversationsLoading);
  const showDiscover = !hasModeWelcome && !isAuthenticated && !isAuthenticationLoading;
  const effectiveModeConfig = useMemo<ThreadModeConfig>(
    () => ({
      ...modeConfig,
      onToolInteraction: async (toolName, action, data) => {
        if (toolName === "delegate" && data.action === "open") {
          if (typeof data.childConversationId === "string") {
            setDelegateConversationId(data.childConversationId);
          }

          return true;
        }

        if (
          toolName === "delegate" &&
          data.action === "stop_all" &&
          typeof data.conversationId === "string"
        ) {
          await cancelDelegations.mutateAsync(data.conversationId);

          return true;
        }

        return (await modeConfig?.onToolInteraction?.(toolName, action, data)) ?? false;
      },
    }),
    [cancelDelegations, modeConfig],
  );

  return (
    <>
      <ConversationThread
        modeConfig={{
          ...effectiveModeConfig,
          welcomeTitle: hasModeWelcome ? modeConfig?.welcomeTitle : welcome.title,
          welcomeDescription: hasModeWelcome ? modeConfig?.welcomeDescription : welcome.description,
          welcomeLoading: isWelcomeLoading,
          welcomeFooter: showDiscover ? <HomeDiscover /> : undefined,
          welcomeFooterHint: showDiscover ? "Keep scrolling for the tour" : undefined,
        }}
      />
      <Dialog
        open={delegateConversationId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDelegateConversationId(null);
          }
        }}
        width="min(56rem, 96vw)"
      >
        <DialogContent className="flex h-[min(44rem,92dvh)] flex-col gap-0 overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3 pr-14">
            <DialogTitle className="text-sm font-semibold">Delegate</DialogTitle>
            <DialogDescription className="text-xs">
              Read the delegate&apos;s transcript without leaving this conversation.
            </DialogDescription>
          </div>
          {delegateConversationId ? (
            <DelegatePanel conversationId={delegateConversationId} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
