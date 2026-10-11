import { describe, expect, it, vi } from "vitest";

import { createAgentRunProgress, followAgentRunEvents } from "./hostedAgentEvents";

function streamResponse(chunks: string[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }

        controller.close();
      },
    }),
  );
}

const noCancel = async () => undefined;
const notExpired = () => false;

describe("followAgentRunEvents", () => {
  it("collects tool activity and stops at the terminal event", async () => {
    const progress = createAgentRunProgress();
    const response = streamResponse([
      `event: tool.started\ndata: {"event":"tool.started","tool":"terminal"}\n\n` +
        `event: tool.completed\ndata: {"event":"tool.completed","tool":"terminal","error":false}\n\n` +
        `event: subagent.complete\ndata: {"event":"subagent.complete","status":"completed"}\n\n` +
        `: keepalive\n\nevent: run.completed\ndata: {"event":"run.completed","output":"Done"}\n\n`,
    ]);

    const outcome = await followAgentRunEvents({
      response,
      progress,
      checkIn: noCancel,
      isExpired: notExpired,
      initialDelayMs: 1,
      maxDelayMs: 5,
    });

    expect(outcome).toEqual({ kind: "terminal" });
    expect(progress).toEqual({ toolsUsed: ["terminal"], toolErrors: 0, subagentCompletions: 1 });
  });

  it("surfaces approval requests without waiting for terminal state", async () => {
    const progress = createAgentRunProgress();
    const response = streamResponse([
      `event: tool.completed\ndata: {"event":"tool.completed","tool":"write_file","error":true}\n\n` +
        `event: approval.request\ndata: {"event":"approval.request","request_id":"req-1"}\n\n`,
    ]);

    const outcome = await followAgentRunEvents({
      response,
      progress,
      checkIn: noCancel,
      isExpired: notExpired,
      initialDelayMs: 1,
      maxDelayMs: 5,
    });

    expect(outcome).toEqual({ kind: "approval-requested" });
    expect(progress.toolsUsed).toEqual(["write_file"]);
    expect(progress.toolErrors).toBe(1);
  });

  it("reports an ended stream so the caller falls back to polling", async () => {
    const progress = createAgentRunProgress();
    const outcome = await followAgentRunEvents({
      response: streamResponse([
        `event: message.delta\ndata: {"event":"message.delta","text":"hi"}\n\n`,
      ]),
      progress,
      checkIn: noCancel,
      isExpired: notExpired,
      initialDelayMs: 1,
      maxDelayMs: 5,
    });

    expect(outcome).toEqual({ kind: "stream-ended" });
  });

  it("reports expiry instead of waiting forever", async () => {
    const progress = createAgentRunProgress();
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start() {
          // Never emits; the deadline decides.
        },
      }),
    );

    const outcome = await followAgentRunEvents({
      response,
      progress,
      checkIn: noCancel,
      isExpired: () => true,
      initialDelayMs: 1,
      maxDelayMs: 5,
    });

    expect(outcome).toEqual({ kind: "expired" });
    response.body?.cancel().catch(() => undefined);
  });

  it("propagates cancellation from the check-in", async () => {
    const progress = createAgentRunProgress();
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start() {},
      }),
    );
    const checkIn = vi.fn(async () => {
      throw new Error("cancelled");
    });

    await expect(
      followAgentRunEvents({
        response,
        progress,
        checkIn,
        isExpired: notExpired,
        initialDelayMs: 1,
        maxDelayMs: 5,
      }),
    ).rejects.toThrow("cancelled");
    response.body?.cancel().catch(() => undefined);
  });
});
