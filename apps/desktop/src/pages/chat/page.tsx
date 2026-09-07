import {
  ConversationSurfaceLayout,
  ConversationThread,
  type ThreadModeConfig,
  useConversationLaunchModeConfig,
} from "@ngriffin_uk/polychat-component-conversation";
import {
  ChatSidebar,
  ConversationProductHeader,
  PageShell,
} from "@ngriffin_uk/polychat-component-shell";
import { PageTitle } from "@ngriffin_uk/polychat-component-ui";
import { useConversationRoute } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

const DESKTOP_MODE_CONFIG: ThreadModeConfig = { analyticsSource: "desktop" };

export default function ChatPage() {
  const { completionId } = useParams<"completionId">();
  const modeConfig = useConversationLaunchModeConfig(DESKTOP_MODE_CONFIG, completionId);

  useConversationRoute({ surface: { kind: "personal" }, pathConversationId: completionId });

  return (
    <PageShell
      sidebarContent={<ChatSidebar />}
      fullBleed
      displayNavBar={false}
      headerContent={<PageTitle title="Conversation" className="sr-only" />}
    >
      <ConversationSurfaceLayout header={<ConversationProductHeader showCloudToggle />}>
        <ConversationThread modeConfig={modeConfig} />
      </ConversationSurfaceLayout>
    </PageShell>
  );
}
