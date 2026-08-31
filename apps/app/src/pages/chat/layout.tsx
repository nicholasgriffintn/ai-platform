import { Outlet, useLocation, useParams } from "react-router";

import { ChatPageShell } from "~/components/Chat/ChatPageShell";

export default function ChatLayout() {
  const { pathname } = useLocation();
  const { completionId } = useParams<"completionId">();
  const isConversation = pathname === "/chat" || Boolean(completionId);

  return (
    <ChatPageShell isConversation={isConversation}>
      <Outlet />
    </ChatPageShell>
  );
}
