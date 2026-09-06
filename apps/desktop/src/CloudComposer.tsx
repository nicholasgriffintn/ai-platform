import type { DesktopRunProgress } from "@ngriffin_uk/polychat-schemas";
import { useCallback, useRef, useState, type FormEvent } from "react";

import type { ConnectedDesktopBackend } from "./desktop-backend";

const PROGRESS_LABELS: Record<string, string> = {
  queued: "Waiting its turn",
  "loading-model": "Loading the model",
  generating: "Generating",
};

export function CloudComposer({
  backend,
  tier,
}: {
  backend: ConnectedDesktopBackend;
  tier: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState("");
  const [progress, setProgress] = useState<DesktopRunProgress | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [isRunning, setRunning] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  const send = useCallback(async () => {
    setReply("");
    setFailure(null);
    setProgress(null);
    setRunning(true);

    try {
      const run = await backend.startHostedRun({
        model: tier,
        messages: [{ role: "user", content: prompt }],
      });

      cancelRef.current = run.cancel;
      let answer = "";

      for await (const event of run.events) {
        if (event.type === "text") {
          answer += event.delta;
          setReply(answer);
        }

        if (event.type === "progress") {
          setProgress(event.state);
        }

        if (event.type === "failed") {
          setFailure(event.message);
        }
      }
    } catch (cause) {
      setFailure(String(cause));
    } finally {
      cancelRef.current = null;
      setProgress(null);
      setRunning(false);
    }
  }, [backend, prompt, tier]);

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();

        if (prompt.trim().length > 0 && !isRunning) {
          void send();
        }
      }}
    >
      <label htmlFor="cloud-prompt">Ask a cloud model</label>
      <textarea
        id="cloud-prompt"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        rows={3}
      />
      <button type="submit" disabled={isRunning || prompt.trim().length === 0}>
        Send
      </button>
      {isRunning ? (
        <button type="button" onClick={() => cancelRef.current?.()}>
          Stop
        </button>
      ) : null}
      {progress ? <p>{PROGRESS_LABELS[progress] ?? progress}</p> : null}
      {failure ? <p role="alert">{failure}</p> : null}
      {reply ? <p>{reply}</p> : null}
    </form>
  );
}
