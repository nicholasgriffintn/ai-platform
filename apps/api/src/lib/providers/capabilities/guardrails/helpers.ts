import { trackGuardrailViolation } from "~/lib/monitoring";
import type {
  GuardrailInput,
  GuardrailResult,
  GuardrailsProvider,
  IEnv,
  IUser,
  IUserSettings,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { providerLibrary } from "../../library";

const DEFAULT_BEDROCK_GUARDRAIL_VERSION = "1";

export function getGuardrailsProvider(
  env: IEnv,
  user?: IUser,
  userSettings?: IUserSettings,
): GuardrailsProvider | null {
  if (!userSettings?.guardrails_enabled) {
    return null;
  }

  if (userSettings.guardrails_provider === "bedrock") {
    if (!userSettings.bedrock_guardrail_id) {
      throw new AssistantError("Missing required guardrail ID", ErrorType.PARAMS_ERROR);
    }

    return providerLibrary.guardrails("bedrock", {
      env,
      user,
      config: {
        guardrailId: userSettings.bedrock_guardrail_id,
        guardrailVersion:
          userSettings.bedrock_guardrail_version || DEFAULT_BEDROCK_GUARDRAIL_VERSION,
        region: env.AWS_REGION || "us-east-1",
        accessKeyId: env.BEDROCK_AWS_ACCESS_KEY,
        secretAccessKey: env.BEDROCK_AWS_SECRET_KEY,
        env,
      },
    });
  }

  if (userSettings.guardrails_provider === "mistral") {
    return providerLibrary.guardrails("mistral", {
      env,
      user,
      config: {
        ai: env.AI,
        env,
        user,
      },
    });
  }

  if (userSettings.guardrails_provider === "shieldstral") {
    return providerLibrary.guardrails("shieldstral", {
      env,
      user,
      config: {
        baseUrl: env.SHIELDSTRAL_BASE_URL,
        apiKey: env.SHIELDSTRAL_API_KEY,
        model: env.SHIELDSTRAL_MODEL,
        policy: env.SHIELDSTRAL_POLICY,
        policyVersion: env.SHIELDSTRAL_POLICY_VERSION,
        threshold:
          env.SHIELDSTRAL_THRESHOLD === undefined ? undefined : Number(env.SHIELDSTRAL_THRESHOLD),
      },
    });
  }

  return providerLibrary.guardrails("llamaguard", {
    env,
    user,
    config: {
      ai: env.AI,
      env,
      user,
    },
  });
}

export class Guardrails {
  private provider: GuardrailsProvider | null;

  constructor(
    private readonly env: IEnv,
    private readonly user?: IUser,
    private readonly userSettings?: IUserSettings,
  ) {
    this.provider = getGuardrailsProvider(env, user, userSettings);
  }

  async validateInput(
    message: GuardrailInput,
    userId?: number,
    completionId?: string,
  ): Promise<GuardrailResult> {
    if (!this.userSettings?.guardrails_enabled || !this.provider) {
      return { provider: "none", isValid: true, violations: [] };
    }

    const result = await this.provider.validateContent(message, "INPUT");

    if (!result?.isValid && result?.violations?.length) {
      trackGuardrailViolation(
        "input_violation",
        {
          provider: result.provider,
          violations: result.violations,
          contentLength: typeof message === "string" ? message.length : message.text.length,
        },
        this.env.ANALYTICS,
        userId,
        completionId,
      );
    }

    return result;
  }

  async validateOutput(
    response: GuardrailInput,
    userId?: number,
    completionId?: string,
  ): Promise<GuardrailResult> {
    if (!this.userSettings?.guardrails_enabled || !this.provider) {
      return { provider: "none", isValid: true, violations: [] };
    }

    const result = await this.provider.validateContent(response, "OUTPUT");

    if (!result?.isValid && result?.violations?.length) {
      trackGuardrailViolation(
        "output_violation",
        {
          provider: result.provider,
          violations: result.violations,
          contentLength: typeof response === "string" ? response.length : response.text.length,
        },
        this.env.ANALYTICS,
        userId,
        completionId,
      );
    }

    return result;
  }
}
