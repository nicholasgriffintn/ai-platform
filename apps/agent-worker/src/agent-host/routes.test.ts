import { getSandbox } from "@cloudflare/sandbox";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POLYCHAT_API_HANDLER, POLYCHAT_API_HOST } from "../config/agent-host";
import type { Env } from "../types";
import { handleAgentHostRequest } from "./routes";

vi.mock("@cloudflare/sandbox", () => ({ getSandbox: vi.fn() }));

describe("handleAgentHostRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes outbound authentication while preserving the host checkpoint", async () => {
    const sandbox = {
      readAgentHostState: vi.fn(async () => ({
        apiServerKey: "local-gateway-key",
        checkpointReference: "checkpoint-1",
        lastCheckpointedRunId: "run_legacy",
      })),
      writeAgentHostState: vi.fn(async () => undefined),
      setOutboundByHost: vi.fn(async () => undefined),
      setOutboundHandler: vi.fn(async () => undefined),
    };

    vi.mocked(getSandbox).mockReturnValue(sandbox as never);
    const request = new Request("https://agent.internal/agent-host/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostId: "hermes-7", serviceToken: "signed-service-token" }),
    });

    const response = await handleAgentHostRequest(request, {} as Env);

    expect(response.status).toBe(200);
    expect(sandbox.writeAgentHostState).toHaveBeenCalledWith({
      apiServerKey: "local-gateway-key",
      checkpointReference: "checkpoint-1",
      lastCheckpointedRunId: "run_legacy",
    });
    expect(sandbox.setOutboundByHost).toHaveBeenCalledWith(
      POLYCHAT_API_HOST,
      POLYCHAT_API_HANDLER,
      { serviceToken: "signed-service-token" },
    );
  });
});
