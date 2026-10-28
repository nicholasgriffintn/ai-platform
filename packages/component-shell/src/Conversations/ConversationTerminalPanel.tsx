import "@xterm/xterm/css/xterm.css";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import { desktopExecutionBackend } from "@ngriffin_uk/polychat-library-chat";
import type { DesktopTerminalEvent } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ConversationTerminalPanelProps {
  conversationId: string;
  directoryId: string;
}

export function ConversationTerminalPanel({
  conversationId,
  directoryId,
}: ConversationTerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState(0);
  const [exited, setExited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const backend = desktopExecutionBackend();
    const container = containerRef.current;

    if (!backend || !container) {
      return undefined;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 12,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    const pending: DesktopTerminalEvent[] = [];
    let terminalId: string | null = null;
    let disposed = false;
    const show = (event: DesktopTerminalEvent) => {
      if (event.type === "output") {
        terminal.write(event.data);
      } else {
        terminal.write("\r\n\x1b[2mThe shell exited.\x1b[0m\r\n");
        setExited(true);
      }
    };

    terminal.loadAddon(fit);
    terminal.open(container);
    fit.fit();
    setExited(false);
    setError(null);

    backend
      .openTerminal(
        { directoryId, conversationId, cols: terminal.cols, rows: terminal.rows },
        (event) => (terminalId ? show(event) : pending.push(event)),
      )
      .then((opened) => {
        if (disposed) {
          return;
        }

        terminal.write(opened.scrollback);
        terminalId = opened.terminalId;
        pending.splice(0).forEach(show);
        terminal.focus();
      })
      .catch((cause: unknown) => {
        setError(getErrorMessage(cause, "The terminal couldn't open."));
      });

    const input = terminal.onData((data) => {
      if (terminalId) {
        void backend.writeTerminal(terminalId, data).catch(() => undefined);
      }
    });
    const observer = new ResizeObserver(() => {
      fit.fit();

      if (terminalId) {
        void backend
          .resizeTerminal(terminalId, terminal.cols, terminal.rows)
          .catch(() => undefined);
      }
    });

    observer.observe(container);

    return () => {
      disposed = true;
      observer.disconnect();
      input.dispose();
      terminal.dispose();
    };
  }, [conversationId, directoryId, session]);

  return (
    <div className="flex h-full min-h-64 flex-col bg-black">
      {error ? <p className="p-3 text-sm text-failure">{error}</p> : null}
      <div ref={containerRef} className="min-h-0 flex-1 p-2" />
      {exited ? (
        <div className="border-t border-border bg-surface-elevated p-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<RotateCcw size={14} />}
            onClick={() => setSession(session + 1)}
          >
            Start a new shell
          </Button>
        </div>
      ) : null}
    </div>
  );
}
