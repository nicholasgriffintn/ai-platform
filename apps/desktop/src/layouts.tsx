import { ChatPlaceShell, WorkPlaceShell } from "@ngriffin_uk/polychat-component-shell";
import type { ComponentType } from "react";
import { Outlet } from "react-router";

function ChatPlaceLayout() {
  return (
    <ChatPlaceShell>
      <Outlet />
    </ChatPlaceShell>
  );
}

function WorkPlaceLayout() {
  return (
    <WorkPlaceShell>
      <Outlet />
    </WorkPlaceShell>
  );
}

export const DESKTOP_LAYOUTS: Record<string, ComponentType> = {
  chat: ChatPlaceLayout,
  work: WorkPlaceLayout,
};
