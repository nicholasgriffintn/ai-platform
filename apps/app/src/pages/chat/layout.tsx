import { Outlet, useLocation } from "react-router";

import { ChatPageShell } from "~/components/Chat/ChatPageShell";

export default function ChatLayout() {
  const { pathname } = useLocation();
  const isConversation = pathname === "/chat";

  return (
    <ChatPageShell isConversation={isConversation}>
      <Outlet />
    </ChatPageShell>
  );
}
