import { bedrockManagedAgentTargetSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

describe("bedrockManagedAgentTargetSchema", () => {
  it("rejects a session role from another account", () => {
    expect(
      bedrockManagedAgentTargetSchema.safeParse({
        runtimeArn: "arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/polychat",
        roleArn: "arn:aws:iam::210987654321:role/agents",
      }).success,
    ).toBe(false);
  });
});
