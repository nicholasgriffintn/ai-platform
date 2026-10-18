import { ChatPlaceShell } from "@ngriffin_uk/polychat-component-shell";
import { isTeammateThreadPath } from "@ngriffin_uk/polychat-library-react";
import { Outlet, useLocation, useParams } from "react-router";
export default function ChatLayout() {
  const { pathname } = useLocation();
  const { completionId } = useParams<"completionId">();
  const isConversation =
    pathname === "/chat" || Boolean(completionId) || isTeammateThreadPath(pathname);

  if (isConversation) {
    return <Outlet />;
  }

  return (
    <ChatPlaceShell>
      <Outlet />
    </ChatPlaceShell>
  );
}
