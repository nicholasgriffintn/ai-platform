import { ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasUserProviderApiKey } from "~/infrastructure/providers/credentials";
import { assertSpeechEntitlement } from "~/modules/audio/application/access";
import type { IEnv, IUser } from "~/types";

vi.mock("~/infrastructure/providers/credentials", () => ({
  hasUserProviderApiKey: vi.fn(),
}));

const env = {} as IEnv;
const freeUser = { id: 8, plan_id: "free" } as IUser;

describe("assertSpeechEntitlement", () => {
  beforeEach(() => {
    vi.mocked(hasUserProviderApiKey).mockReset().mockResolvedValue(false);
  });

  it("refuses a free account on the platform voice", async () => {
    await expect(assertSpeechEntitlement(env, freeUser, "workers-ai")).rejects.toMatchObject({
      type: ErrorType.AUTHORISATION_ERROR,
    });
  });

  it("lets a free account use its own provider key", async () => {
    vi.mocked(hasUserProviderApiKey).mockResolvedValue(true);

    await expect(assertSpeechEntitlement(env, freeUser, "elevenlabs")).resolves.toBeUndefined();
  });
});
