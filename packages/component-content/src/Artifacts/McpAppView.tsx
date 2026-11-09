import {
  buildMcpAppAllow,
  buildMcpAppFrameUrl,
  buildMcpAppHtml,
  createMcpAppHostBridge,
  isMcpAppFrameReady,
  MCP_APP_FRAME_HTML,
  MCP_APP_SANDBOX,
  teardownRequest,
  type McpAppDisplayMode,
} from "@ngriffin_uk/polychat-library-chat/mcp-apps";
import type {
  McpAppCallToolResult,
  McpAppView as McpAppViewData,
} from "@ngriffin_uk/polychat-schemas";
import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_HEIGHT = 320;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 1200;

export interface McpAppViewProps {
  app: McpAppViewData;
  frameDocumentUrl: string;
  displayMode?: McpAppDisplayMode;
  theme: "light" | "dark";
  callTool: (tool: string, args: Record<string, unknown>) => Promise<McpAppCallToolResult>;
  onMessage?: (text: string) => void;
}

export function McpAppView({
  app,
  frameDocumentUrl,
  displayMode = "inline",
  theme,
  callTool,
  onMessage,
}: McpAppViewProps) {
  const fills = displayMode === "fullscreen";
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const frameUrl = useMemo(
    () => buildMcpAppFrameUrl(frameDocumentUrl, app.ui.csp),
    [frameDocumentUrl, app.ui.csp],
  );

  useEffect(() => {
    const frame = iframeRef.current;

    if (!frame) {
      return;
    }

    const bridge = createMcpAppHostBridge({
      displayMode,
      toolName: app.tool,
      toolArguments: app.arguments,
      toolResult: app.result,
      theme,
      callbacks: {
        post: (message) => frame.contentWindow?.postMessage(message, "*"),
        callTool: (tool, args) => callTool(tool, args),
        openLink: (url) => window.open(url, "_blank", "noopener,noreferrer"),
        sendMessage: (text) => onMessage?.(text),
        resize: (size) => {
          if (typeof size.height === "number") {
            setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.ceil(size.height))));
          }
        },
      },
    });
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) {
        return;
      }

      if (isMcpAppFrameReady(event.data)) {
        frame.contentWindow?.postMessage(
          { type: MCP_APP_FRAME_HTML, html: buildMcpAppHtml(app.html) },
          "*",
        );

        return;
      }

      void bridge.receive(event.data);
    };

    window.addEventListener("message", listener);

    return () => {
      window.removeEventListener("message", listener);
      frame.contentWindow?.postMessage(teardownRequest("unmounted"), "*");
    };
  }, [app.html, app.tool, app.arguments, app.result, callTool, displayMode, onMessage, theme]);

  return (
    <iframe
      ref={iframeRef}
      title={`${app.integration}: ${app.tool}`}
      src={frameUrl}
      sandbox={MCP_APP_SANDBOX}
      allow={buildMcpAppAllow(app.ui.permissions)}
      referrerPolicy="no-referrer"
      className={
        app.ui.prefersBorder === false
          ? "w-full bg-transparent"
          : "w-full rounded-lg border border-border bg-surface"
      }
      style={{ height: fills ? "100%" : height }}
    />
  );
}
