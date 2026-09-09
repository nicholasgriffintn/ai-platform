import {
  createCodexAdapter,
  type AgentSessionAdapter,
  type DesktopAgentSession,
  type DesktopBackend,
} from "@ngriffin_uk/polychat-library-chat";
import type { AgentRuntimeVendor, AgentSessionEvent } from "@ngriffin_uk/polychat-schemas";

export class AgentSessionUnavailableError extends Error {
  constructor(name: string) {
    super(`${name} does not run as a session yet.`);
    this.name = "AgentSessionUnavailableError";
  }
}

export interface AgentSessionHost {
  readonly adapter: AgentSessionAdapter;
  readonly directoryPath: string;
  readonly directoryId: string;
  listen: (listener: (event: AgentSessionEvent) => void) => () => void;
  stop: () => Promise<void>;
}

type HostBackend = Pick<DesktopBackend, "startAgentSession">;

interface HostKeyInput {
  conversationId: string;
  driver: AgentRuntimeVendor;
  directoryId: string;
}

export function agentSessionHostKey(input: HostKeyInput): string {
  return `${input.driver}:${input.conversationId}`;
}

function createAdapter(
  driver: AgentRuntimeVendor,
  session: DesktopAgentSession,
  clientVersion: string | undefined,
  emit: (event: AgentSessionEvent) => void,
): AgentSessionAdapter {
  if (driver !== "codex") {
    throw new AgentSessionUnavailableError(driver);
  }

  return createCodexAdapter({
    transport: { send: (payload) => session.send(payload) },
    emit,
    clientVersion,
  });
}

export function createAgentSessionRegistry() {
  const hosts = new Map<string, Promise<AgentSessionHost>>();

  function forgetIfCurrent(key: string, host: AgentSessionHost): void {
    const current = hosts.get(key);

    if (!current) {
      return;
    }

    void current.then(
      (resolved) => {
        if (resolved === host && hosts.get(key) === current) {
          hosts.delete(key);
        }
      },
      () => undefined,
    );
  }

  async function build(
    backend: HostBackend,
    input: HostKeyInput,
    clientVersion: string | undefined,
  ): Promise<AgentSessionHost> {
    const key = agentSessionHostKey(input);
    const session = await backend.startAgentSession(
      input.driver,
      input.directoryId,
      input.conversationId,
    );
    const listeners = new Set<(event: AgentSessionEvent) => void>();
    const emit = (event: AgentSessionEvent) => {
      for (const listener of listeners) {
        listener(event);
      }
    };

    const adapter = createAdapter(input.driver, session, clientVersion, emit);

    const host: AgentSessionHost = {
      adapter,
      directoryPath: session.directoryPath,
      directoryId: input.directoryId,
      listen: (listener) => {
        listeners.add(listener);

        return () => listeners.delete(listener);
      },
      stop: async () => {
        forgetIfCurrent(key, host);
        adapter.close("The session was stopped.");
        await session.stop();
      },
    };

    void (async () => {
      try {
        for await (const line of session.transport) {
          adapter.receive(line);
        }
      } finally {
        forgetIfCurrent(key, host);
        emit({ type: "session.exited", reason: "The agent process stopped." });
      }
    })();

    void (async () => {
      for await (const event of session.events) {
        emit(event);
      }
    })();

    return host;
  }

  return {
    async acquire(
      backend: HostBackend,
      input: HostKeyInput,
      clientVersion: string | undefined,
    ): Promise<AgentSessionHost> {
      const key = agentSessionHostKey(input);
      const existing: Promise<AgentSessionHost | undefined> =
        hosts.get(key) ?? Promise.resolve(undefined);
      const next: Promise<AgentSessionHost> = existing.then(
        async (host) => {
          if (host?.directoryId === input.directoryId) {
            return host;
          }

          await host?.stop();

          return build(backend, input, clientVersion);
        },
        () => build(backend, input, clientVersion),
      );

      hosts.set(key, next);
      void next.catch(() => {
        if (hosts.get(key) === next) {
          hosts.delete(key);
        }
      });

      return next;
    },

    async release(input: HostKeyInput): Promise<void> {
      const key = agentSessionHostKey(input);
      const existing = hosts.get(key);

      if (!existing) {
        return;
      }

      await (await existing).stop();
    },

    size(): number {
      return hosts.size;
    },
  };
}

export const agentSessions = createAgentSessionRegistry();
