import { abortableDelay } from "@ngriffin_uk/polychat-utility-core";

import { runContainerCommand, type ContainerExecutor } from "./container-command.js";

export const CONTAINER_INTERCEPTION_CA = "/etc/cloudflare/certs/cloudflare-containers-ca.crt";
const SYSTEM_CA_BUNDLE = "/etc/ssl/certs/ca-certificates.crt";
const ORIGINAL_CA_BUNDLE = "/etc/ssl/certs/ca-certificates.original.crt";

type EgressContainer = Pick<Container, "interceptOutboundHttps" | "interceptAllOutboundHttp">;
type PortContainer = Pick<Container, "getTcpPort">;

export async function interceptContainerEgress(
  container: EgressContainer,
  outbound: Fetcher,
): Promise<void> {
  await container.interceptOutboundHttps("*", outbound);
  await container.interceptAllOutboundHttp(outbound);
}

export async function trustContainerInterception(container: ContainerExecutor): Promise<void> {
  const script = [
    `for attempt in $(seq 1 50); do [ -s ${CONTAINER_INTERCEPTION_CA} ] && break; sleep 0.2; done`,
    `[ -s ${CONTAINER_INTERCEPTION_CA} ] || { echo "Interception certificate did not appear" >&2; exit 1; }`,
    `[ -f ${ORIGINAL_CA_BUNDLE} ] || cp ${SYSTEM_CA_BUNDLE} ${ORIGINAL_CA_BUNDLE}`,
    `cat ${ORIGINAL_CA_BUNDLE} ${CONTAINER_INTERCEPTION_CA} > ${SYSTEM_CA_BUNDLE}`,
  ].join("\n");
  const result = await runContainerCommand(container, script, { cwd: "/", timeoutMs: 20_000 });

  if (!result.success) {
    throw new Error(
      result.stderr.trim() || "Could not trust the container interception certificate",
    );
  }
}

export interface ContainerPortProbe {
  mode?: "http" | "tcp";
  path?: string;
  expectedStatus?: { min: number; max: number };
}

async function portAnswers(
  container: PortContainer,
  port: number,
  probe: ContainerPortProbe,
): Promise<boolean> {
  const fetcher = container.getTcpPort(port);

  if (probe.mode === "tcp") {
    const socket = fetcher.connect(`localhost:${port}`);

    return socket.opened
      .then(async () => {
        await socket.close();

        return true;
      })
      .catch(() => false);
  }

  return fetcher
    .fetch(`http://container${probe.path ?? "/"}`, { redirect: "manual" })
    .then(async (response) => {
      await response.body?.cancel();

      return probe.expectedStatus === undefined
        ? response.status < 500
        : response.status >= probe.expectedStatus.min &&
            response.status <= probe.expectedStatus.max;
    })
    .catch(() => false);
}

export async function waitForContainerPort(
  container: PortContainer,
  port: number,
  options: ContainerPortProbe & { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<void> {
  const deadline = Date.now() + (options.timeoutMs ?? 60_000);
  let delayMs = 200;

  for (;;) {
    options.signal?.throwIfAborted();

    if (await portAnswers(container, port, options)) {
      return;
    }

    if (Date.now() >= deadline) {
      throw new Error(`Port ${port} did not become ready`);
    }

    await abortableDelay(Math.min(delayMs, Math.max(0, deadline - Date.now())), options.signal);
    delayMs = Math.min(2_000, Math.ceil(delayMs * 1.5));
  }
}
