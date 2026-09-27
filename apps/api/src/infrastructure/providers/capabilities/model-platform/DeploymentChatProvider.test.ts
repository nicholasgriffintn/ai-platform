import { ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { describe, expect, it } from "vitest";

import { DeploymentChatProvider } from "./DeploymentChatProvider";

describe("deployment chat authority", () => {
  it("requires an actor before accessing a workspace deployment", async () => {
    const provider = new DeploymentChatProvider();

    await expect(
      provider.getResponse({
        model: "deployment:deployment-id",
        messages: [{ role: "user", content: "hello" }],
        get env(): never {
          throw new Error("Workspace credentials must not be read without an actor");
        },
      }),
    ).rejects.toMatchObject({ type: ErrorType.AUTHENTICATION_ERROR });
  });
});
