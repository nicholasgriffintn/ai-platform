import type { DiscoveredModel } from "@ngriffin_uk/polychat-schemas";
import { useState, type FormEvent } from "react";

import type { ConnectedDesktopBackend } from "./desktop-backend";
import { useModelRun } from "./useModelRun";

const PROGRESS_LABELS: Record<string, string> = {
  queued: "Waiting its turn",
  "loading-model": "Loading the model",
  generating: "Generating",
};

export function Composer({
  backend,
  model,
}: {
  backend: ConnectedDesktopBackend;
  model: DiscoveredModel;
}) {
  const [prompt, setPrompt] = useState("");
  const { messages, reply, progress, failure, isRunning, send, cancel } = useModelRun(
    backend,
    model,
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (prompt.trim().length === 0 || isRunning) {
      return;
    }

    void send(prompt);
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor={`prompt-${model.nativeId}`}>Ask {model.displayName}</label>
      <textarea
        id={`prompt-${model.nativeId}`}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        rows={3}
      />
      <button type="submit" disabled={isRunning || prompt.trim().length === 0}>
        Send
      </button>
      {isRunning ? (
        <button type="button" onClick={cancel}>
          Stop
        </button>
      ) : null}
      {progress ? <p>{PROGRESS_LABELS[progress] ?? progress}</p> : null}
      {failure ? <p role="alert">{failure}</p> : null}
      <ol>
        {messages.map((message) => (
          <li key={message.id}>
            <span>{message.role === "user" ? "You" : model.displayName}</span>
            <p>{message.content}</p>
          </li>
        ))}
      </ol>
      {reply ? <p>{reply}</p> : null}
    </form>
  );
}
