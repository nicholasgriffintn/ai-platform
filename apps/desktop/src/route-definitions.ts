import { MODE_BASE_PATHS } from "@ngriffin_uk/polychat-library-react";

export type DesktopPage = "redirect-to-chat" | "chat" | "not-found";

export interface DesktopRouteDefinition {
  path: string;
  page: DesktopPage;
}

const UNMIGRATED_CHAT_PATHS = [
  "attention",
  "files/*",
  "teammates",
  "teammates/:teammateId",
  "apps/:appId/*",
  "tools/:toolId",
];

export const DESKTOP_ROUTE_DEFINITIONS: readonly DesktopRouteDefinition[] = [
  { path: "/", page: "redirect-to-chat" },
  { path: MODE_BASE_PATHS.chat, page: "chat" },
  ...UNMIGRATED_CHAT_PATHS.map<DesktopRouteDefinition>((path) => ({
    path: `${MODE_BASE_PATHS.chat}/${path}`,
    page: "not-found",
  })),
  { path: `${MODE_BASE_PATHS.chat}/:completionId`, page: "chat" },
  { path: "*", page: "not-found" },
];
