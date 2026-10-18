import {
  buildMcpAppAllow,
  buildMcpAppDocument,
  createMcpAppHostBridge,
  MCP_APP_SANDBOX,
  teardownRequest,
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
  theme: "light" | "dark";
  callTool: (tool: string, args: Record<string, unknown>) => Promise<McpAppCallToolResult>;
  onMessage?: (text: string) => void;
}

export function McpAppView({ app, theme, callTool, onMessage }: McpAppViewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const document = useMemo(() => buildMcpAppDocument(app.html, app.ui.csp), [app.html, app.ui.csp]);

  useEffect(() => {
    const frame = iframeRef.current;

    if (!frame) {
      return;
    }

    const bridge = createMcpAppHostBridge({
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
      if (event.source === frame.contentWindow) {
        void bridge.receive(event.data);
      }
    };

    window.addEventListener("message", listener);

    return () => {
      window.removeEventListener("message", listener);
      frame.contentWindow?.postMessage(teardownRequest("unmounted"), "*");
    };
  }, [app.tool, app.arguments, app.result, callTool, onMessage, theme]);

  return (
    <iframe
      ref={iframeRef}
      title={`${app.integration}: ${app.tool}`}
      srcDoc={document}
      sandbox={MCP_APP_SANDBOX}
      allow={buildMcpAppAllow(app.ui.permissions)}
      referrerPolicy="no-referrer"
      className={
        app.ui.prefersBorder === false
          ? "w-full bg-transparent"
          : "w-full rounded-lg border border-border bg-surface"
      }
      style={{ height }}
    />
  );
}
