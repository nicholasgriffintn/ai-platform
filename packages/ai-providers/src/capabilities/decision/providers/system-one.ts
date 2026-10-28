import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { DecisionResponse } from "@ngriffin_uk/polychat-schemas";

import { resolveHostProviderApiKey } from "../../../credentials.js";
import type { ProviderEnv, ProviderUser } from "../../../env.js";
import { fetchProviderJson } from "../../../fetch.js";
import { trackProviderMetrics } from "../../../metrics.js";
import type { ProviderRuntime } from "../../../runtime.js";
import type { DecisionProvider, DecisionRequest } from "../../../types/decision.js";
import {
  assertTextOnlyDecisionRequest,
  normaliseDecisionResponse,
} from "../../../utils/decisions.js";
import { GREENPT_API_KEY_ENV, GREENPT_PROVIDER_NAME } from "../../../utils/greenpt.js";
import { requireRequestModel } from "../../../utils/required-model.js";

const logger = getLogger({ prefix: "lib/decision/system-one" });

export const TYPESAFE_PROVIDER_NAME = "typesafe";
export const TYPESAFE_API_BASE_URL = "https://api.typesafe.ai";
export const GREENPT_SYSTEM_ONE_BASE_URL = "https://api.greenpt.ai";

export interface SystemOneVendor {
  name: string;
  label: string;
  envKeyName: string;
  baseUrl: string;
  baseUrlEnvName?: string;
}

export const TYPESAFE_SYSTEM_ONE: SystemOneVendor = {
  name: TYPESAFE_PROVIDER_NAME,
  label: "TypeSafe",
  envKeyName: "TYPESAFE_API_KEY",
  baseUrl: TYPESAFE_API_BASE_URL,
  baseUrlEnvName: "TYPESAFE_BASE_URL",
};

export const GREENPT_SYSTEM_ONE: SystemOneVendor = {
  name: GREENPT_PROVIDER_NAME,
  label: "GreenPT",
  envKeyName: GREENPT_API_KEY_ENV,
  baseUrl: GREENPT_SYSTEM_ONE_BASE_URL,
};

export const SYSTEM_ONE_PROVIDER_NAMES = [TYPESAFE_SYSTEM_ONE.name, GREENPT_SYSTEM_ONE.name];

function resolveBaseUrl(env: ProviderEnv, vendor: SystemOneVendor): string {
  const configured = vendor.baseUrlEnvName ? env[vendor.baseUrlEnvName] : undefined;

  return typeof configured === "string" && configured.trim()
    ? configured.trim().replace(/\/+$/, "")
    : vendor.baseUrl;
}

export class SystemOneDecisionProvider implements DecisionProvider {
  readonly name: string;

  constructor(
    private readonly vendor: SystemOneVendor,
    private readonly env: ProviderEnv,
    private readonly user: ProviderUser | undefined,
    private readonly runtime: ProviderRuntime,
  ) {
    this.name = vendor.name;
  }

  async decide(request: DecisionRequest): Promise<DecisionResponse> {
    assertTextOnlyDecisionRequest(request, this.vendor.label);
    const model = requireRequestModel(request.model, "decision");
    const apiKey = await resolveHostProviderApiKey(this.runtime.host, {
      env: this.env,
      providerName: this.name,
      envKeyName: this.vendor.envKeyName,
      userId: this.user?.id,
      logger,
    });
    const baseUrl = resolveBaseUrl(this.env, this.vendor);

    return trackProviderMetrics(this.runtime.host, {
      provider: this.name,
      model,
      env: this.env,
      userId: this.user?.id,
      completion_id: request.completion_id,
      settings: { questionCount: Object.keys(request.questions).length },
      operation: async () => {
        const raw = await fetchProviderJson<unknown>(this.name, `${baseUrl}/v1/systemone`, {
          apiKey,
          body: { state: request.state, model, questions: request.questions },
        });

        return normaliseDecisionResponse(raw, this.name, model);
      },
    });
  }
}
