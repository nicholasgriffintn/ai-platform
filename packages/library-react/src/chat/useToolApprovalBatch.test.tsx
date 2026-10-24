/** @vitest-environment jsdom */
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useToolApprovalBatch, type ToolApprovalDecision } from "./useToolApprovalBatch.js";

function pendingApproval(callId: string): Message {
  return {
    id: `tool-${callId}`,
    role: "tool",
    content: "Send it?",
    status: "pending",
    run_id: "run-1",
    tool_call_id: callId,
    data: {
      renderer: "approval_request",
      approvalRequired: true,
      approval: { interactionId: callId, toolName: "send_email" },
    },
  };
}

function decision(callId: string): ToolApprovalDecision {
  return {
    toolName: "send_email",
    response: {
      option: "Approve",
      approvalRequired: true,
      interactionId: callId,
      resolution: "approved",
    },
  };
}

const messages = [pendingApproval("call-1"), pendingApproval("call-2")];

afterEach(cleanup);

describe("useToolApprovalBatch", () => {
  it("holds decisions until the whole set is decided and the stream has paused", async () => {
    const submit = vi.fn<(decisions: ToolApprovalDecision[]) => Promise<void>>(async () => {});
    const { result, rerender } = renderHook(
      ({ isStreaming }) => useToolApprovalBatch({ messages, isStreaming, submit }),
      { initialProps: { isStreaming: true } },
    );

    act(() => {
      result.current.record(decision("call-1"));
    });
    act(() => {
      result.current.record(decision("call-2"));
    });

    expect(submit).not.toHaveBeenCalled();

    rerender({ isStreaming: false });

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0]?.[0].map((item) => item.response.interactionId)).toEqual([
      "call-1",
      "call-2",
    ]);
  });

  it("does not send while any approval in the run is still undecided", () => {
    const submit = vi.fn<(decisions: ToolApprovalDecision[]) => Promise<void>>(async () => {});
    const { result } = renderHook(() =>
      useToolApprovalBatch({ messages, isStreaming: false, submit }),
    );

    act(() => {
      result.current.record(decision("call-2"));
    });

    expect(result.current.decidedCount).toBe(1);
    expect(submit).not.toHaveBeenCalled();
  });
});
