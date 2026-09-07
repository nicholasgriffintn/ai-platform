import {
  ConversationThread,
  useConversationLaunchModeConfig,
} from "@ngriffin_uk/polychat-component-conversation";
import type { ThreadModeConfig } from "@ngriffin_uk/polychat-component-conversation";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useChats,
  useConversationRoute,
  createChatWelcome,
} from "@ngriffin_uk/polychat-library-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";

import { HomeDiscover } from "../Discover/HomeDiscover.js";

interface HomeConversationThreadProps {
  urlModeConfig?: ThreadModeConfig;
}

export function HomeConversationThread({ urlModeConfig }: HomeConversationThreadProps) {
  const { completionId } = useParams<"completionId">();
  const modeConfig = useConversationLaunchModeConfig(urlModeConfig, completionId);

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

  return (
    <ConversationThread
      modeConfig={{
        ...modeConfig,
        welcomeTitle: hasModeWelcome ? modeConfig?.welcomeTitle : welcome.title,
        welcomeDescription: hasModeWelcome ? modeConfig?.welcomeDescription : welcome.description,
        welcomeLoading: isWelcomeLoading,
        welcomeFooter: showDiscover ? <HomeDiscover /> : undefined,
        welcomeFooterHint: showDiscover ? "Keep scrolling for the tour" : undefined,
      }}
    />
  );
}
