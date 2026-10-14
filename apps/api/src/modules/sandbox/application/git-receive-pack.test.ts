import { describe, expect, it } from "vitest";

import { inspectGitReceivePackBody } from "./git-receive-pack";

describe("Git receive-pack inspection", () => {
  it("returns pushed branch refs without consuming the body", async () => {
    const line = `${"1".repeat(40)} ${"2".repeat(40)} refs/heads/polychat/run-123\0 report-status\n`;
    const request = `${(line.length + 4).toString(16).padStart(4, "0")}${line}0000PACK`;
    const inspected = await inspectGitReceivePackBody(new Response(request).body);

    expect(inspected.refs).toEqual(["refs/heads/polychat/run-123"]);
    await expect(new Response(inspected.body).text()).resolves.toBe(request);
  });

  it("rejects branch deletion commands", async () => {
    const line = `${"1".repeat(40)} ${"0".repeat(40)} refs/heads/polychat/run-123\n`;
    const request = `${(line.length + 4).toString(16).padStart(4, "0")}${line}0000`;

    await expect(inspectGitReceivePackBody(new Response(request).body)).rejects.toThrow(
      "Unsupported Git receive-pack command",
    );
  });
});
