import type { ProviderHost } from "@ngriffin_uk/polychat-ai-providers";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

import { recordProviderQuotaExhausted } from "../provider-quota";
import { withProviderQuotaTracking } from "../provider-quota-tracking";

vi.mock("../provider-quota", () => ({ recordProviderQuotaExhausted: vi.fn() }));

const host = {} as ProviderHost;
const context = { env: { DB: {} } as IEnv, user: { id: 7 } as IUser };

function audioProvider(error: Error) {
  return {
    name: "elevenlabs",
    synthesize: vi.fn().mockRejectedValue(error),
    voiceFor: (role: string) => `${role}-voice`,
  };
}

describe("withProviderQuotaTracking", () => {
  beforeEach(() => {
    vi.mocked(recordProviderQuotaExhausted).mockReset().mockResolvedValue(undefined);
  });

  it("records the provider as out of credits before rethrowing", async () => {
    const error = new AssistantError("quota", ErrorType.PROVIDER_ERROR, 401, {
      responseJson: { detail: { code: "quota_exceeded" } },
    });
    const provider = withProviderQuotaTracking(host, "elevenlabs", audioProvider(error), context);

    await expect(provider.synthesize()).rejects.toBe(error);
    expect(recordProviderQuotaExhausted).toHaveBeenCalledWith(host, context.env, {
      provider: "elevenlabs",
      userId: 7,
    });
    expect(provider.voiceFor("host")).toBe("host-voice");
  });

  it("leaves other failures and anonymous calls alone", async () => {
    const outage = new AssistantError("down", ErrorType.PROVIDER_ERROR, 503);
    const tracked = withProviderQuotaTracking(host, "elevenlabs", audioProvider(outage), context);
    const quota = new AssistantError("quota", ErrorType.PROVIDER_ERROR, 402);
    const anonymous = withProviderQuotaTracking(host, "elevenlabs", audioProvider(quota), {
      env: context.env,
    });

    await expect(tracked.synthesize()).rejects.toBe(outage);
    await expect(anonymous.synthesize()).rejects.toBe(quota);
    expect(recordProviderQuotaExhausted).not.toHaveBeenCalled();
  });
});
