import { PageTitle } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

import { ChatSidebar } from "../Chat/ChatSidebar.js";
import { PageShell } from "./PageShell.js";

export function ChatConversationShell({
  title,
  sidebarContent,
  children,
}: {
  title: string;
  sidebarContent?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageShell
      sidebarContent={sidebarContent ?? <ChatSidebar />}
      fullBleed
      displayNavBar={false}
      headerContent={<PageTitle title={title} className="sr-only" />}
    >
      {children}
    </PageShell>
  );
}
