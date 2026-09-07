import { describe, expect, it } from "vitest";

import { submitRunInstructionSchema } from "./sandbox.js";

function instruction(command: string) {
  return submitRunInstructionSchema.safeParse({
    kind: "run_command",
    idempotencyKey: "instruction-1",
    command,
  });
}

describe("run_command instructions", () => {
  it("accepts a single ordinary command", () => {
    expect(instruction("pnpm test").success).toBe(true);
  });

  it("refuses a credential before it reaches the instruction log", () => {
    const result = instruction("NPM_TOKEN=npm_abcdefghijklmnop pnpm install");

    expect(result.success).toBe(false);
  });

  it("refuses a backgrounded command", () => {
    expect(instruction("pnpm dev &").success).toBe(false);
  });

  it("refuses more than one line", () => {
    expect(instruction("pnpm build\npnpm test").success).toBe(false);
  });

  it("refuses a command longer than the sandbox command policy allows", () => {
    expect(instruction(`echo ${"a".repeat(600)}`).success).toBe(false);
  });

  it("requires a command for the kind", () => {
    const result = submitRunInstructionSchema.safeParse({
      kind: "run_command",
      idempotencyKey: "instruction-1",
    });

    expect(result.success).toBe(false);
  });
});
