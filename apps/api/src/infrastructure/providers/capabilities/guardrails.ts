import type {
  GuardrailInput,
  GuardrailResult,
  GuardrailsProvider,
} from "@ngriffin_uk/polychat-ai-providers";
import { DEFAULT_GUARDRAILS_PROVIDER } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { createMetrics } from "~/infrastructure/telemetry";
import type { IEnv, IUser, IUserSettings } from "~/types";

import { providerHost } from "../host";
import { providerLibrary } from "../library";

export type { GuardrailInput, GuardrailResult, GuardrailsProvider };

const DEFAULT_BEDROCK_GUARDRAIL_VERSION = "1";

function llamaGuardProvider(env: IEnv, user?: IUser): GuardrailsProvider {
  return providerLibrary.resolve("guardrails", "llamaguard", {
    env,
    user,
    config: {
      ai: env.AI,
      env,
      user,
    },
  });
}

export async function getGuardrailsProvider(
  env: IEnv,
  user?: IUser,
  userSettings?: IUserSettings,
): Promise<GuardrailsProvider | null> {
  if (!userSettings?.guardrails_enabled) {
    return null;
  }

  const providerId = userSettings.guardrails_provider ?? DEFAULT_GUARDRAILS_PROVIDER;

  if (providerId === "bedrock") {
    if (!userSettings.bedrock_guardrail_id) {
      throw new AssistantError("Missing required guardrail ID", ErrorType.PARAMS_ERROR);
    }

    return providerLibrary.resolve("guardrails", "bedrock", {
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

  if (providerId === "mistral") {
    return providerLibrary.resolve("guardrails", "mistral", {
      env,
      user,
      config: {
        ai: env.AI,
        env,
        user,
      },
    });
  }

  if (providerId === "shieldstral") {
    return providerLibrary.resolve("guardrails", "shieldstral", {
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

  if (providerId === "typesafe") {
    const decisionModel = await providerHost.models.getAuxiliaryDecisionModel(env, user);

    if (decisionModel) {
      return providerLibrary.resolve("guardrails", "typesafe", {
        env,
        user,
        config: { env, user },
      });
    }
  }

  return llamaGuardProvider(env, user);
}

export class Guardrails {
  private provider?: Promise<GuardrailsProvider | null>;

  constructor(
    private readonly env: IEnv,
    private readonly user?: IUser,
    private readonly userSettings?: IUserSettings,
  ) {}

  private resolveProvider(): Promise<GuardrailsProvider | null> {
    this.provider ??= getGuardrailsProvider(this.env, this.user, this.userSettings);

    return this.provider;
  }

  async validateInput(
    message: GuardrailInput,
    userId?: number,
    completionId?: string,
  ): Promise<GuardrailResult> {
    const provider = await this.resolveProvider();

    if (!provider) {
      return { provider: "none", isValid: true, violations: [] };
    }

    const result = await provider.validateContent(message, "INPUT");

    if (!result?.isValid && result?.violations?.length) {
      createMetrics(this.env).trackGuardrailViolation(
        "input_violation",
        {
          provider: result.provider,
          violations: result.violations,
          contentLength: typeof message === "string" ? message.length : message.text.length,
        },
        {
          userId: userId ?? this.user?.id,
          email: this.user?.email,
          planId: this.user?.plan_id,
        },
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
    const provider = await this.resolveProvider();

    if (!provider) {
      return { provider: "none", isValid: true, violations: [] };
    }

    const result = await provider.validateContent(response, "OUTPUT");

    if (!result?.isValid && result?.violations?.length) {
      createMetrics(this.env).trackGuardrailViolation(
        "output_violation",
        {
          provider: result.provider,
          violations: result.violations,
          contentLength: typeof response === "string" ? response.length : response.text.length,
        },
        {
          userId: userId ?? this.user?.id,
          email: this.user?.email,
          planId: this.user?.plan_id,
        },
        completionId,
      );
    }

    return result;
  }
}
