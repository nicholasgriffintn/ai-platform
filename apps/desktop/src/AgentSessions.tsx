import type {
  AgentApprovalRequest,
  AgentRuntimeSession,
  DesktopEndpoint,
} from "@ngriffin_uk/polychat-schemas";
import { useCallback, useEffect, useState } from "react";

import type { ConnectedDesktopBackend } from "./desktop-backend";

const APPROVAL_LABELS: Record<string, string> = {
  command: "run a command",
  "file-write": "change files",
  network: "reach the network",
  tool: "use a tool",
  unknown: "do something it did not describe",
};

const SESSION_LABELS: Record<AgentRuntimeSession["state"], string> = {
  idle: "Idle",
  running: "Working",
  "awaiting-approval": "Waiting for you",
  failed: "Failed",
};

export function AgentSessions({
  backend,
  endpoint,
}: {
  backend: ConnectedDesktopBackend;
  endpoint: DesktopEndpoint;
}) {
  const [sessions, setSessions] = useState<AgentRuntimeSession[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState("");
  const [approval, setApproval] = useState<AgentApprovalRequest | null>(null);
  const [isRunning, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const listed = await backend.listAgentSessions(endpoint.id);

        if (active) {
          setSessions(listed);
        }
      } catch (cause) {
        if (active) {
          setError(String(cause));
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [backend, endpoint.id]);

  const send = useCallback(async () => {
    if (!selected) {
      return;
    }

    setRunning(true);
    setReply("");
    setError(null);

    try {
      const run = await backend.startAgentRun({
        endpointId: endpoint.id,
        sessionNativeId: selected,
        conversationId: `${endpoint.id}:${selected}`,
        prompt,
      });

      let answer = "";

      for await (const event of run.events) {
        if (event.type === "text") {
          answer += event.delta;
          setReply(answer);
        }

        if (event.type === "approval-required") {
          setApproval(event.request);
        }

        if (event.type === "failed") {
          setError(event.message);
        }
      }
    } catch (cause) {
      setError(String(cause));
    } finally {
      setRunning(false);
    }
  }, [backend, endpoint.id, prompt, selected]);

  const decide = useCallback(
    async (approved: boolean) => {
      if (!approval) {
        return;
      }

      try {
        await backend.decideApproval(endpoint.id, {
          requestId: approval.id,
          approved,
          decidedAt: new Date().toISOString(),
        });
        setApproval(null);
      } catch (cause) {
        setError(String(cause));
      }
    },
    [approval, backend, endpoint.id],
  );

  return (
    <section>
      <h3>Sessions on {endpoint.label}</h3>
      {error ? <p role="alert">{error}</p> : null}
      {sessions.length === 0 ? <p>No sessions here yet.</p> : null}
      <ul>
        {sessions.map((session) => (
          <li key={session.nativeId}>
            <button type="button" onClick={() => setSelected(session.nativeId)}>
              {session.title ?? session.nativeId}
            </button>
            <span>{SESSION_LABELS[session.state]}</span>
            {session.origin ? <span>from {session.origin}</span> : null}
            <span>on {session.executingHost}</span>
          </li>
        ))}
      </ul>
      {selected ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();

            if (prompt.trim().length > 0 && !isRunning) {
              void send();
            }
          }}
        >
          <label htmlFor={`agent-prompt-${endpoint.id}`}>Say something to this session</label>
          <textarea
            id={`agent-prompt-${endpoint.id}`}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
          />
          <button type="submit" disabled={isRunning || prompt.trim().length === 0}>
            Send
          </button>
          {reply ? <p>{reply}</p> : null}
        </form>
      ) : null}
      {approval ? (
        <aside>
          <p>
            {approval.summary} — this wants to {APPROVAL_LABELS[approval.kind] ?? approval.kind} on{" "}
            {approval.executingHost}.
          </p>
          {approval.detail ? <pre>{approval.detail}</pre> : null}
          <button type="button" onClick={() => void decide(true)}>
            Allow once
          </button>
          <button type="button" onClick={() => void decide(false)}>
            Refuse
          </button>
        </aside>
      ) : null}
    </section>
  );
}
