import { getSandbox } from "@cloudflare/sandbox";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POLYCHAT_API_HANDLER, POLYCHAT_API_HOST } from "../config/agent-host";
import type { Env } from "../types";
import { handleAgentHostRequest } from "./routes";

vi.mock("@cloudflare/sandbox", () => ({ getSandbox: vi.fn() }));

const RUN_ID = `run_${"b".repeat(32)}`;

function provisionedSandbox(overrides: Record<string, unknown> = {}): Record<string, any> {
  return {
    readAgentHostState: vi.fn(async () => ({
      apiServerKey: "local-gateway-key",
      checkpointReference: "checkpoint-1",
      lastCheckpointedRunId: "run_legacy",
    })),
    writeAgentHostState: vi.fn(async () => undefined),
    clearAgentHostState: vi.fn(async () => undefined),
    setOutboundByHost: vi.fn(async () => undefined),
    setOutboundHandler: vi.fn(async () => undefined),
    listProcesses: vi.fn(async () => [
      {
        command: "/usr/local/bin/start-hermes",
        status: "running",
        waitForPort: vi.fn(async () => undefined),
      },
    ]),
    exec: vi.fn(async () => ({ success: true })),
    restoreBackup: vi.fn(async () => undefined),
    startProcess: vi.fn(async () => ({ waitForPort: vi.fn(async () => undefined) })),
    containerFetch: vi.fn(async () => new Response("not found", { status: 404 })),
    createBackup: vi.fn(async () => ({ id: "backup-1", dir: "/workspace/hermes" })),
    destroy: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("handleAgentHostRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes outbound authentication while preserving the host checkpoint", async () => {
    const sandbox = provisionedSandbox();

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

  it("stores declared network hosts on provision", async () => {
    const sandbox = provisionedSandbox();

    vi.mocked(getSandbox).mockReturnValue(sandbox as never);
    const request = new Request("https://agent.internal/agent-host/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostId: "hermes-7",
        serviceToken: "signed-service-token",
        networkHosts: ["api.example.com"],
      }),
    });

    const response = await handleAgentHostRequest(request, {} as Env);

    expect(response.status).toBe(200);
    expect(sandbox.writeAgentHostState).toHaveBeenCalledWith(
      expect.objectContaining({ networkHosts: ["api.example.com"] }),
    );
    expect(sandbox.setOutboundHandler).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ hosts: expect.arrayContaining(["api.example.com"]) }),
    );
  });

  it("rejects invalid network hosts on provision", async () => {
    const sandbox = provisionedSandbox();

    vi.mocked(getSandbox).mockReturnValue(sandbox as never);
    const request = new Request("https://agent.internal/agent-host/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostId: "hermes-7",
        serviceToken: "signed-service-token",
        networkHosts: ["not a host!!"],
      }),
    });

    const response = await handleAgentHostRequest(request, {} as Env);

    expect(response.status).toBe(400);
  });

  it("wakes the gateway before reading run status", async () => {
    const snapshot = { run_id: RUN_ID, status: "completed", output: "Done" };
    const sandbox = provisionedSandbox({
      readAgentHostState: vi.fn(async () => ({ apiServerKey: "local-gateway-key" })),
      listProcesses: vi.fn(async () => []),
      exec: vi.fn(async () => ({ success: true })),
      restoreBackup: vi.fn(async () => undefined),
      startProcess: vi.fn(async () => ({ waitForPort: vi.fn(async () => undefined) })),
      containerFetch: vi.fn(async () => Response.json(snapshot)),
    });

    vi.mocked(getSandbox).mockReturnValue(sandbox as never);
    const request = new Request("https://agent.internal/agent-host/run-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostId: "hermes-7", runId: RUN_ID }),
    });

    const response = await handleAgentHostRequest(request, {} as Env);

    expect(response.status).toBe(200);
    expect(sandbox.startProcess).toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ run_id: RUN_ID, status: "completed" });
  });

  it("forwards instructions and the idempotency key when starting a run", async () => {
    let forwarded: Request | undefined;
    const sandbox = provisionedSandbox({
      containerFetch: vi.fn(async (request: Request) => {
        forwarded = request;

        return Response.json({ run_id: RUN_ID });
      }),
    });

    vi.mocked(getSandbox).mockReturnValue(sandbox as never);
    const response = await handleAgentHostRequest(
      new Request("https://agent.internal/agent-host/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostId: "hermes-7",
          sessionId: "polychat-conv-1",
          input: "Plan my week",
          instructions: "Be helpful",
          idempotencyKey: "unique-key-1",
        }),
      }),
      {} as Env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ runId: RUN_ID });
    const forwardedBody = (await forwarded?.json()) as Record<string, unknown>;

    expect(forwardedBody).toMatchObject({
      input: "Plan my week",
      session_id: "polychat-conv-1",
      instructions: "Be helpful",
    });
    expect(forwarded?.headers.get("Idempotency-Key")).toBe("unique-key-1");
  });

  it("proxies the run-events stream without buffering it", async () => {
    const sse = `event: tool.started\ndata: {"tool":"terminal"}\n\n`;
    let forwarded: Request | undefined;
    const sandbox = provisionedSandbox({
      containerFetch: vi.fn(async (request: Request) => {
        forwarded = request;

        return new Response(sse, { status: 200 });
      }),
    });

    vi.mocked(getSandbox).mockReturnValue(sandbox as never);
    const response = await handleAgentHostRequest(
      new Request("https://agent.internal/agent-host/run-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: "hermes-7", runId: RUN_ID }),
      }),
      {} as Env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    await expect(response.text()).resolves.toBe(sse);
    expect(forwarded?.method).toBe("GET");
    expect(forwarded?.url).toContain(`/v1/runs/${RUN_ID}/events`);
  });

  it("steers a live run and maps rejection to 409", async () => {
    const sandbox = provisionedSandbox({
      containerFetch: vi.fn(async () => Response.json({ run_id: RUN_ID, accepted: true })),
    });

    vi.mocked(getSandbox).mockReturnValue(sandbox as never);
    const steered = await handleAgentHostRequest(
      new Request("https://agent.internal/agent-host/run-steer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: "hermes-7", runId: RUN_ID, input: "Also check X" }),
      }),
      {} as Env,
    );

    expect(steered.status).toBe(200);
    await expect(steered.json()).resolves.toEqual({ accepted: true });

    const parked = provisionedSandbox({
      containerFetch: vi.fn(async () => new Response("nope", { status: 409 })),
    });

    vi.mocked(getSandbox).mockReturnValue(parked as never);
    const rejected = await handleAgentHostRequest(
      new Request("https://agent.internal/agent-host/run-steer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: "hermes-7", runId: RUN_ID, input: "Also check X" }),
      }),
      {} as Env,
    );

    expect(rejected.status).toBe(409);
  });

  it("forwards the picked model and model options when starting a run", async () => {
    let forwarded: Request | undefined;
    const sandbox = provisionedSandbox({
      containerFetch: vi.fn(async (request: Request) => {
        forwarded = request;

        return Response.json({ run_id: RUN_ID });
      }),
    });

    vi.mocked(getSandbox).mockReturnValue(sandbox as never);
    const response = await handleAgentHostRequest(
      new Request("https://agent.internal/agent-host/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostId: "hermes-7",
          sessionId: "polychat-conv-1",
          input: "Plan my week",
          model: "gpt-5",
          modelOptions: { reasoning_effort: "high" },
        }),
      }),
      {} as Env,
    );

    expect(response.status).toBe(200);
    const forwardedBody = (await forwarded?.json()) as Record<string, unknown>;

    expect(forwardedBody).toMatchObject({
      model: "gpt-5",
      model_options: { reasoning_effort: "high" },
    });
  });

  it("maps an unknown run to an interrupted snapshot with resume guidance", async () => {
    const sandbox = provisionedSandbox();

    vi.mocked(getSandbox).mockReturnValue(sandbox as never);
    const request = new Request("https://agent.internal/agent-host/run-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostId: "hermes-7", runId: RUN_ID }),
    });

    const response = await handleAgentHostRequest(request, {} as Env);
    const payload = (await response.json()) as { status: string; error: string };

    expect(response.status).toBe(200);
    expect(payload.status).toBe("interrupted");
    expect(payload.error).toContain("Session history is preserved");
  });

  it("checkpoints a terminal run once", async () => {
    const snapshot = { run_id: RUN_ID, status: "completed", output: "Done" };
    const sandbox = provisionedSandbox({
      readAgentHostState: vi.fn(async () => ({ apiServerKey: "local-gateway-key" })),
      containerFetch: vi.fn(async () => Response.json(snapshot)),
    });

    vi.mocked(getSandbox).mockReturnValue(sandbox as never);
    const request = new Request("https://agent.internal/agent-host/run-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostId: "hermes-7", runId: RUN_ID }),
    });

    const response = await handleAgentHostRequest(request, {} as Env);

    expect(response.status).toBe(200);
    expect(sandbox.createBackup).toHaveBeenCalledOnce();
    expect(sandbox.writeAgentHostState).toHaveBeenCalledWith(
      expect.objectContaining({ lastCheckpointedRunId: RUN_ID }),
    );
  });

  it("supports explicit checkpoint and health actions", async () => {
    const sandbox = provisionedSandbox();

    vi.mocked(getSandbox).mockReturnValue(sandbox as never);

    const checkpoint = await handleAgentHostRequest(
      new Request("https://agent.internal/agent-host/checkpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: "hermes-7" }),
      }),
      {} as Env,
    );

    expect(checkpoint.status).toBe(200);
    expect(sandbox.createBackup).toHaveBeenCalledOnce();

    const health = await handleAgentHostRequest(
      new Request("https://agent.internal/agent-host/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: "hermes-7" }),
      }),
      {} as Env,
    );

    await expect(health.json()).resolves.toMatchObject({
      provisioned: true,
      gateway: "running",
    });
  });

  it("deprovisions the host container and state", async () => {
    const sandbox = provisionedSandbox();

    vi.mocked(getSandbox).mockReturnValue(sandbox as never);
    const response = await handleAgentHostRequest(
      new Request("https://agent.internal/agent-host/deprovision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: "hermes-7" }),
      }),
      {} as Env,
    );

    expect(response.status).toBe(200);
    expect(sandbox.destroy).toHaveBeenCalledOnce();
    expect(sandbox.clearAgentHostState).toHaveBeenCalledOnce();
  });

  it("returns 409 for unprovisioned hosts", async () => {
    const sandbox = provisionedSandbox({
      readAgentHostState: vi.fn(async () => null),
    });

    vi.mocked(getSandbox).mockReturnValue(sandbox as never);
    const response = await handleAgentHostRequest(
      new Request("https://agent.internal/agent-host/run-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: "hermes-7", runId: RUN_ID }),
      }),
      {} as Env,
    );

    expect(response.status).toBe(409);
  });
});
