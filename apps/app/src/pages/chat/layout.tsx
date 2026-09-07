import { ChatSidebar, PageShell } from "@ngriffin_uk/polychat-component-shell";
import { Outlet, useLocation, useParams } from "react-router";
export default function ChatLayout() {
  const { pathname } = useLocation();
  const { completionId } = useParams<"completionId">();
  const isConversation = pathname === "/chat" || Boolean(completionId);

  if (isConversation) {
    return <Outlet />;
  }

  return (
    <PageShell title="Chat" sidebarContent={<ChatSidebar />} fullBleed displayNavBar={false}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div data-header-scroll-source className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </PageShell>
  );
}
