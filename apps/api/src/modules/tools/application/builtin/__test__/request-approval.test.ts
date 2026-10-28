import { projectTaskToolApprovalSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { request_approval } from "../human_in_the_loop";

describe("request_approval", () => {
  it("records the tool call as the approval's interaction so the task can be answered from Inbox", async () => {
    const result = await request_approval.execute(
      { message: "Claude wants to run rm build" },
      Object.assign(Object.create(null), {
        completionId: "task-conversation",
        toolCallId: "hx-2-perm-1",
        request: { user: { id: 7 } },
      }),
    );

    expect(result).toMatchObject({
      status: "pending",
      data: {
        humanInTheLoop: {
          type: "approval",
          interactionId: "hx-2-perm-1",
          toolName: "request_approval",
        },
      },
    });
    expect(projectTaskToolApprovalSchema.parse(result.data.approval)).toEqual({
      interactionId: "hx-2-perm-1",
      toolName: "request_approval",
      reason: "Claude wants to run rm build",
    });
  });
});
