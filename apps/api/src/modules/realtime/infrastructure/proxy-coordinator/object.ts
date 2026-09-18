import { Agent } from "agents";

import type { IEnv } from "~/types";

export const MAX_REALTIME_PROXY_SESSIONS_PER_USER = 3;

interface StoredProxySession {
  expiresAt: number;
  sessionId: string;
}

interface ConsumeRequest {
  expiresAt: number;
  jti: string;
  sessionExpiresAt: number;
  sessionId: string;
}

const GRANT_PREFIX = "grant:";
const SESSION_PREFIX = "session:";

function isConsumeRequest(value: unknown): value is ConsumeRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.jti === "string" &&
    candidate.jti.length > 0 &&
    typeof candidate.sessionId === "string" &&
    candidate.sessionId.length > 0 &&
    typeof candidate.expiresAt === "number" &&
    Number.isFinite(candidate.expiresAt) &&
    typeof candidate.sessionExpiresAt === "number" &&
    Number.isFinite(candidate.sessionExpiresAt)
  );
}

export class RealtimeProxyCoordinator extends Agent<IEnv> {
  private get storage(): DurableObjectStorage {
    return this.ctx.storage;
  }

  private async consume(request: ConsumeRequest): Promise<Response> {
    return Response.json(
      await this.ctx.blockConcurrencyWhile(async () => {
        const now = Date.now();
        const grantKey = `${GRANT_PREFIX}${request.jti}`;
        const consumedUntil = await this.storage.get<number>(grantKey);

        if (consumedUntil && consumedUntil > now) {
          return { acquired: false, reason: "replayed" } as const;
        }

        const storedSessions = await this.storage.list<StoredProxySession>({
          prefix: SESSION_PREFIX,
        });
        const expiredKeys = [...storedSessions]
          .filter(([, session]) => session.expiresAt <= now)
          .map(([key]) => key);

        if (expiredKeys.length > 0) {
          await this.storage.delete(expiredKeys);
        }

        // Consume before the quota decision so a refused grant cannot be replayed later.
        await this.storage.put(grantKey, request.expiresAt);

        if (storedSessions.size - expiredKeys.length >= MAX_REALTIME_PROXY_SESSIONS_PER_USER) {
          return { acquired: false, reason: "concurrency" } as const;
        }

        await this.storage.put(`${SESSION_PREFIX}${request.jti}`, {
          expiresAt: request.sessionExpiresAt,
          sessionId: request.sessionId,
        } satisfies StoredProxySession);

        return { acquired: true } as const;
      }),
    );
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/consume" && request.method === "POST") {
      const body = await request.json().catch(() => undefined);

      if (!isConsumeRequest(body)) {
        return Response.json({ error: "Invalid reservation" }, { status: 400 });
      }

      return this.consume(body);
    }

    if (pathname === "/release" && request.method === "POST") {
      const body = (await request.json().catch(() => undefined)) as { jti?: unknown } | undefined;

      if (typeof body?.jti !== "string" || !body.jti) {
        return Response.json({ error: "Invalid reservation" }, { status: 400 });
      }

      await this.storage.delete(`${SESSION_PREFIX}${body.jti}`);

      return Response.json({ released: true });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
