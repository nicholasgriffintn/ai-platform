import { useEffect, useMemo, useState } from "react";

import { ConversationThread } from "~/components/ConversationThread";
import type { ConversationThreadModeConfig } from "~/components/ConversationThread";
import { useConversationLaunchModeConfig } from "~/components/ConversationThread/useConversationLaunchModeConfig";
import { useChats } from "~/hooks/useChat";
import { createChatWelcome } from "~/lib/chat-welcome";
import { useChatStore } from "~/state/stores/chatStore";

interface HomeConversationThreadProps {
  urlModeConfig?: ConversationThreadModeConfig;
}

export function HomeConversationThread({ urlModeConfig }: HomeConversationThreadProps) {
  const modeConfig = useConversationLaunchModeConfig(urlModeConfig);
  const user = useChatStore((state) => state.user);
  const userSettings = useChatStore((state) => state.userSettings);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);
  const { data: conversations = [], isLoading: areConversationsLoading } = useChats();
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

  return (
    <ConversationThread
      modeConfig={{
        ...modeConfig,
        modeControls: {
          ...modeConfig?.modeControls,
          includeSettingCommands: false,
        },
        welcomeTitle: hasModeWelcome ? modeConfig?.welcomeTitle : welcome.title,
        welcomeDescription: hasModeWelcome ? modeConfig?.welcomeDescription : welcome.description,
        welcomeLoading: isWelcomeLoading,
      }}
    />
  );
}
