import { readServerSentEvents } from "@ngriffin_uk/polychat-utility-core";
import { describe, expect, it, vi } from "vitest";

import {
  agentHarnessSessionKey,
  collectHarnessProviderStream,
  followHarnessRecords,
  harnessRecordToProviderChunks,
  parseApprovalToolCallId,
  readHarnessRecords,
} from "../harness-stream";
import { streamHarnessRecords } from "../harness-turn";

async function* recordsOf(
  ...records: Parameters<typeof harnessRecordToProviderChunks>[0][]
): AsyncGenerator<Parameters<typeof harnessRecordToProviderChunks>[0]> {
  for (const record of records) {
    yield record;
  }
}

describe("harnessRecordToProviderChunks", () => {
  it("ends the turn with an approval tool call whose id carries the resume cursor", async () => {
    const collected = await collectHarnessProviderStream(
      streamHarnessRecords({
        records: recordsOf(
          {
            seq: 42,
            event: {
              type: "approval-requested",
              approvalId: "approval_1",
              toolName: "run_command",
              description: "Run `rm -rf dist`",
            },
          },
          { seq: 43, event: { type: "text-delta", partId: "p", delta: "ignored" } },
        ),
        harnessName: "Pi",
        deadline: Date.now() + 60_000,
        checkIn: async () => undefined,
        onExpired: async () => undefined,
      }),
    );
    const [toolCall] = collected.toolCalls;

    expect(collected.response).toBe("");
    expect(toolCall?.function.name).toBe("request_approval");
    expect(JSON.parse(toolCall?.function.arguments ?? "{}").message).toContain("Run `rm -rf dist`");
    expect(parseApprovalToolCallId(toolCall?.id)).toEqual({ seq: 42, approvalId: "approval_1" });
  });

  it("only settles the turn it started and reports failures as stream errors", () => {
    const settled = (operationId: string, status: "done" | "unanswered") => ({
      seq: 9,
      event: {
        type: "operation-settled" as const,
        operationId,
        status,
        ...(status === "unanswered" ? { reason: "model unavailable" } : {}),
      },
    });

    expect(
      harnessRecordToProviderChunks(settled("other", "done"), {
        harnessName: "Pi",
        operationId: "mine",
      }),
    ).toEqual({ chunks: [], done: false });
    expect(
      harnessRecordToProviderChunks(settled("mine", "unanswered"), {
        harnessName: "Pi",
        operationId: "mine",
      }),
    ).toEqual({
      chunks: [{ error: { message: "Pi stopped: model unavailable" } }],
      done: true,
    });
  });
});

describe("agentHarnessSessionKey", () => {
  it("scopes sessions to the user and keeps keys within the allowed alphabet", () => {
    expect(agentHarnessSessionKey(7, "conv/with spaces")).toBe("7-conv-with-spaces");
  });
});

describe("streamHarnessRecords", () => {
  it("streams text and tool activity and collects a buffered reply", async () => {
    const stream = streamHarnessRecords({
      records: recordsOf(
        { seq: 1, event: { type: "text-delta", partId: "p", delta: "Checking " } },
        {
          seq: 2,
          event: { type: "tool-started", toolCallId: "t1", toolName: "read_file", input: {} },
        },
        { seq: 3, event: { type: "text-delta", partId: "p", delta: "done." } },
        { seq: 4, event: { type: "operation-settled", operationId: "op", status: "done" } },
        { seq: 5, event: { type: "text-delta", partId: "p", delta: "ignored" } },
      ),
      harnessName: "OpenCode Cloud",
      operationId: "op",
      deadline: Date.now() + 60_000,
      checkIn: async () => undefined,
      onExpired: async () => undefined,
    });

    await expect(collectHarnessProviderStream(stream)).resolves.toEqual({
      response: "Checking done.",
      toolCalls: [],
    });
  });

  it("reports the running token total across every model call in the turn", async () => {
    const stream = streamHarnessRecords({
      records: recordsOf(
        { seq: 1, event: { type: "usage", inputTokens: 100, outputTokens: 20 } },
        { seq: 2, event: { type: "usage", inputTokens: 150, outputTokens: 30 } },
        { seq: 3, event: { type: "operation-settled", operationId: "op", status: "done" } },
      ),
      harnessName: "Pi",
      operationId: "op",
      deadline: Date.now() + 60_000,
      checkIn: async () => undefined,
      onExpired: async () => undefined,
    });
    const usage: unknown[] = [];

    await readServerSentEvents(stream, {
      onEvent: (chunk) => {
        if (chunk.usage) {
          usage.push(chunk.usage);
        }
      },
    });

    expect(usage.at(-1)).toEqual({ prompt_tokens: 250, completion_tokens: 50, total_tokens: 300 });
  });
});

describe("hosted harness event streams", () => {
  it("finishes the turn and cancels the open event stream once its operation settles", async () => {
    const cancel = vi.fn();
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `${JSON.stringify({ seq: 1, event: { type: "text-delta", partId: "p", delta: "Done" } })}\n${JSON.stringify({ seq: 2, event: { type: "operation-settled", operationId: "op", status: "done" } })}\n`,
          ),
        );
      },
      cancel,
    });
    const reading = new AbortController();

    const collected = await collectHarnessProviderStream(
      streamHarnessRecords({
        records: readHarnessRecords(source, reading.signal),
        harnessName: "Pi",
        operationId: "op",
        deadline: Date.now() + 60_000,
        checkIn: async () => undefined,
        onExpired: async () => undefined,
        release: () => reading.abort(),
      }),
    );

    expect(collected.response).toBe("Done");
    await vi.waitFor(() => expect(cancel).toHaveBeenCalled());
  });
});

describe("followHarnessRecords", () => {
  it("reconnects from the last record it saw when the event stream drops", async () => {
    const line = (seq: number, delta: string) =>
      new TextEncoder().encode(
        `${JSON.stringify({ seq, event: { type: "text-delta", partId: "p", delta } })}\n`,
      );
    const cursors: number[] = [];
    const open = async (after: number) => {
      cursors.push(after);

      let pulls = 0;

      return new ReadableStream<Uint8Array>({
        pull(controller) {
          pulls += 1;

          if (after > 0) {
            controller.enqueue(line(2, " again"));
          } else if (pulls === 1) {
            controller.enqueue(line(1, "Hello"));
          } else {
            controller.error(
              new Error("ReadableStream received over RPC disconnected prematurely."),
            );
          }
        },
      });
    };
    const reading = new AbortController();
    const seen: number[] = [];

    for await (const record of followHarnessRecords(open, 0, reading.signal)) {
      seen.push(record.seq);

      if (record.seq === 2) {
        reading.abort();
      }
    }

    expect(seen).toEqual([1, 2]);
    expect(cursors).toEqual([0, 1]);
  });
});
