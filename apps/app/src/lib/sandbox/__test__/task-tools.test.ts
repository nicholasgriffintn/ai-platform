import { describe, expect, it } from "vitest";

import { SANDBOX_TASK_TOOL_NAME, getSandboxTaskToolNames } from "../task-tools";

describe("sandbox task tools", () => {
  it("exposes one tool whatever the task type, because the type is an argument", () => {
    expect(getSandboxTaskToolNames()).toEqual([SANDBOX_TASK_TOOL_NAME]);
  });
});
