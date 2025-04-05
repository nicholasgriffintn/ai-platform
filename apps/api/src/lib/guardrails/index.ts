import type { GuardrailResult, GuardrailsProvider, IEnv } from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";
import { trackGuardrailViolation } from "../monitoring";
import { GuardrailsProviderFactory } from "./factory";

export class Guardrails {
  private static instance: Guardrails;
  private provider: GuardrailsProvider;
  private env: IEnv;

  private constructor(env: IEnv) {
    this.env = env;

    if (env.GUARDRAILS_ENABLED === "false") {
      this.provider = null;
    } else if (env.GUARDRAILS_PROVIDER === "bedrock") {
      if (
        !env.BEDROCK_AWS_ACCESS_KEY ||
        !env.BEDROCK_AWS_SECRET_KEY ||
        !env.BEDROCK_GUARDRAIL_ID
      ) {
        throw new AssistantError(
          "Missing required AWS credentials or guardrail ID",
          ErrorType.PARAMS_ERROR,
        );
      }

      this.provider = GuardrailsProviderFactory.getProvider("bedrock", {
        guardrailId: env.BEDROCK_GUARDRAIL_ID,
        guardrailVersion: env.BEDROCK_GUARDRAIL_VERSION || "DRAFT",
        region: env.AWS_REGION || "us-east-1",
        accessKeyId: env.BEDROCK_AWS_ACCESS_KEY,
        secretAccessKey: env.BEDROCK_AWS_SECRET_KEY,
      });
    } else {
      // Default to LlamaGuard if no specific provider is set
      this.provider = GuardrailsProviderFactory.getProvider("llamaguard", {
        ai: env.AI,
      });
    }
  }

  public static getInstance(env: IEnv): Guardrails {
    if (!Guardrails.instance) {
      Guardrails.instance = new Guardrails(env);
    }
    return Guardrails.instance;
  }

  async validateInput(
    message: string,
    userId?: number,
    completionId?: string,
  ): Promise<GuardrailResult> {
    if (this.env.GUARDRAILS_ENABLED === "false") {
      return { isValid: true, violations: [] };
    }
    const result = await this.provider.validateContent(message, "INPUT");
    if (!result.isValid && result.violations.length > 0) {
      trackGuardrailViolation(
        "input_violation",
        {
          message,
          violations: result.violations,
        },
        this.env.ANALYTICS,
        userId,
        completionId,
      );
    }
    return result;
  }

  async validateOutput(
    response: string,
    userId?: number,
    completionId?: string,
  ): Promise<GuardrailResult> {
    if (this.env.GUARDRAILS_ENABLED === "false") {
      return { isValid: true, violations: [] };
    }
    const result = await this.provider.validateContent(response, "OUTPUT");
    if (!result.isValid && result.violations.length > 0) {
      trackGuardrailViolation(
        "output_violation",
        {
          response,
          violations: result.violations,
        },
        this.env.ANALYTICS,
        userId,
        completionId,
      );
    }
    return result;
  }
}
