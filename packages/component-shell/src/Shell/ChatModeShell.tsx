import type { ReactNode } from "react";

import { ChatSidebar } from "../Chat/ChatSidebar.js";
import { ProductShell } from "./ProductShell.js";

export function ChatModeShell({ children }: { children: ReactNode }) {
  return (
    <ProductShell sidebarContent={<ChatSidebar />} displayNavBar={false}>
      {children}
    </ProductShell>
  );
}
