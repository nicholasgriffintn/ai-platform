import { ChatPlaceShell } from "@ngriffin_uk/polychat-component-shell";
import { isTeammateThreadPath, MODE_BASE_PATHS } from "@ngriffin_uk/polychat-library-react";
import { trimTrailingCharacters } from "@ngriffin_uk/polychat-utility-core";
import { Outlet, useLocation, useParams } from "react-router";
export default function ChatLayout() {
  const { pathname } = useLocation();
  const { completionId } = useParams<"completionId">();
  const isConversation =
    trimTrailingCharacters(pathname, "/") === MODE_BASE_PATHS.chat ||
    Boolean(completionId) ||
    isTeammateThreadPath(pathname);

  if (isConversation) {
    return <Outlet />;
  }

  return (
    <ChatPlaceShell>
      <Outlet />
    </ChatPlaceShell>
  );
}
