import { ChatModeShell } from "@ngriffin_uk/polychat-component-shell";
import { Outlet } from "react-router";

export default function ChatModeLayout() {
  return (
    <ChatModeShell>
      <Outlet />
    </ChatModeShell>
  );
}
