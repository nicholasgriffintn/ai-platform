import { MachineRunClient } from "@ngriffin_uk/polychat-library-client/machine-runs";
import {
  machineSandboxRunRequestSchema,
  type MachineRunSnapshot,
} from "@ngriffin_uk/polychat-schemas";
import { delay } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import { safeParseJson } from "./json";
import { createPolychatRequest } from "./polychat-request";

const POLL_INTERVAL_MS = 1000;
const localSandboxResponseSchema = z.object({
  status: z.number().int().min(100).max(599),
  body: z.string(),
  contentType: z.string().nullable(),
});

export class LocalSandboxRelay {
  private readonly client: MachineRunClient;
  private active: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly machineId: string,
    userToken: string,
    api: Pick<Fetcher, "fetch">,
    private readonly signal?: AbortSignal,
  ) {
    this.client = new MachineRunClient((path, options = {}) =>
      api.fetch(
        createPolychatRequest(path, {
          method: options.method,
          signal: options.signal,
          headers: {
            Authorization: `Bearer ${userToken}`,
            "Content-Type": "application/json",
          },
          body: options.body == null ? undefined : JSON.stringify(options.body),
        }),
      ),
    );
  }

  private async execute(
    operation: z.infer<typeof machineSandboxRunRequestSchema>["operation"],
    ignoreAbort = false,
  ): Promise<unknown> {
    const signal = ignoreAbort ? undefined : this.signal;

    signal?.throwIfAborted();
    const id = crypto.randomUUID();
    let snapshot: MachineRunSnapshot = await this.client.start(
      this.machineId,
      machineSandboxRunRequestSchema.parse({ id, kind: "sandbox", operation }),
      signal,
    );

    while (snapshot.state === "pending" || snapshot.state === "running") {
      await delay(POLL_INTERVAL_MS, signal);
      snapshot = await this.client.read(this.machineId, id, signal);
    }

    if (snapshot.state !== "completed") {
      throw new Error(
        snapshot.error || "The desktop sandbox stopped before completing its request",
      );
    }

    const result = safeParseJson(snapshot.text);

    if (result === null) {
      throw new Error("The desktop sandbox returned an invalid response");
    }

    return result;
  }

  private serialise<T>(work: () => Promise<T>): Promise<T> {
    const result = this.active.then(work);

    this.active = result.catch(() => undefined);

    return result;
  }

  async start(): Promise<string> {
    return this.serialise(async () => {
      const result = z
        .object({ containerId: z.string().regex(/^[a-f0-9]{64}$/) })
        .parse(await this.execute({ type: "start" }));

      return result.containerId;
    });
  }

  async request(input: {
    containerId: string;
    path: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: string;
    contentType?: "application/json";
  }): Promise<z.infer<typeof localSandboxResponseSchema>> {
    return this.serialise(async () =>
      localSandboxResponseSchema.parse(await this.execute({ type: "request", ...input })),
    );
  }

  async stop(containerId: string): Promise<void> {
    await this.serialise(async () => {
      await this.execute({ type: "stop", containerId }, true);
    });
  }
}
