import { McpAppView } from "@ngriffin_uk/polychat-component-content";
import { EmptyState, Link } from "@ngriffin_uk/polychat-component-ui";
import { themeAppearance } from "@ngriffin_uk/polychat-library-chat";
import { callMcpAppTool, useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  getPlacePaths,
  useRemoteAppView,
  useResolvedThemeId,
} from "@ngriffin_uk/polychat-library-react";
import type { AppEntry, ProjectExperienceDefinition } from "@ngriffin_uk/polychat-schemas";
import { ArrowLeft } from "lucide-react";
import { useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { useAppChrome } from "./AppChrome.js";

export function RemoteMcpApp({
  app,
  entry,
  fallback,
}: {
  app: ProjectExperienceDefinition;
  entry: Extract<AppEntry, { kind: "remote" }>;
  fallback?: ReactNode;
}) {
  const chrome = useAppChrome();
  const navigate = useNavigate();
  const setChatInput = useChatStore((state) => state.setChatInput);
  const theme = themeAppearance(useResolvedThemeId());
  const { data: view, error, isLoading } = useRemoteAppView(entry);
  const callTool = useCallback(
    (tool: string, args: Record<string, unknown>) =>
      callMcpAppTool({ integration: entry.server, tool, arguments: args }),
    [entry.server],
  );
  const onMessage = useCallback(
    (text: string) => {
      setChatInput(text);
      void navigate(getPlacePaths("chat").conversations);
    },
    [navigate, setChatInput],
  );

  if (isLoading) {
    return fallback;
  }

  if (!view) {
    return (
      <EmptyState
        title="App unavailable"
        message={error?.message ?? `${app.name} did not return a view.`}
      />
    );
  }

  const frame = (
    <McpAppView
      app={view}
      displayMode="fullscreen"
      theme={theme}
      callTool={callTool}
      onMessage={onMessage}
    />
  );

  if (app.surface.layout === "contained") {
    return <div className="h-[70dvh] min-h-[28rem]">{frame}</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
        {chrome?.backHref && (
          <Link
            href={chrome.backHref}
            aria-label={chrome.backLabel ?? "Back"}
            className="flex items-center text-muted-foreground no-underline hover:text-foreground"
          >
            <ArrowLeft size={16} />
          </Link>
        )}
        <h1 className="truncate text-sm font-medium">{app.name}</h1>
      </div>
      <div className="min-h-0 flex-1 p-2">{frame}</div>
    </div>
  );
}
