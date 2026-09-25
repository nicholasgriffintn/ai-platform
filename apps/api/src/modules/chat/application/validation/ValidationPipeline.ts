import type { ModelConfigItem, ModelTier, ReasoningEffort } from "@ngriffin_uk/polychat-schemas";

import { AuthValidator } from "~/modules/chat/application/validation/validators/AuthValidator";
import { BasicInputValidator } from "~/modules/chat/application/validation/validators/BasicInputValidator";
import { ContextLimitValidator } from "~/modules/chat/application/validation/validators/ContextLimitValidator";
import { GuardrailsValidator } from "~/modules/chat/application/validation/validators/GuardrailsValidator";
import { ModelConfigValidator } from "~/modules/chat/application/validation/validators/ModelConfigValidator";
import type { CoreChatOptions, Message } from "~/types";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  violations?: any[];
  rawViolations?: any;
  validationType?: "input" | "output" | "auth" | "model" | "context";
}

export interface ValidationContext {
  sanitisedMessages?: Message[];
  lastMessage?: Message;
  messageWithContext?: string;
  modelConfig?: ModelConfigItem;
  guardrails?: any;
  selectedModels?: string[];
  modelTier?: ModelTier;
  reasoningEffort?: ReasoningEffort;
  analyticsProperties?: Record<string, string>;
}

export interface ValidatorResult {
  validation: ValidationResult;
  context: ValidationContext;
}

export interface Validator {
  validate(options: CoreChatOptions, context: ValidationContext): Promise<ValidatorResult>;
}

export class ValidationPipeline {
  private validators: Validator[] = [
    new AuthValidator(),
    new BasicInputValidator(),
    new ModelConfigValidator(),
    new ContextLimitValidator(),
    new GuardrailsValidator(),
  ];

  async validate(
    options: CoreChatOptions,
    initialContext: ValidationContext = {},
  ): Promise<ValidatorResult> {
    const currentContext = { ...initialContext };

    for (const validator of this.validators) {
      const result = await validator.validate(options, { ...currentContext });

      if (!result?.validation?.isValid) {
        return {
          validation: result?.validation || {
            isValid: false,
            error: "Validator returned invalid result",
            validationType: "input",
          },
          context: currentContext,
        };
      }

      Object.assign(currentContext, result.context);
    }

    return {
      validation: { isValid: true },
      context: currentContext,
    };
  }

  addValidator(validator: Validator): void {
    this.validators.push(validator);
  }

  removeValidator(validatorClass: new (...args: any[]) => Validator): void {
    this.validators = this.validators.filter((v) => !(v instanceof validatorClass));
  }
}
