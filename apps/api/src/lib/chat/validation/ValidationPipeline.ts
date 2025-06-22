import type { CoreChatOptions } from "~/types";
import { AuthValidator } from "./validators/AuthValidator";
import { BasicInputValidator } from "./validators/BasicInputValidator";
import { ContextLimitValidator } from "./validators/ContextLimitValidator";
import { GuardrailsValidator } from "./validators/GuardrailsValidator";
import { ModelConfigValidator } from "./validators/ModelConfigValidator";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  violations?: any[];
  rawViolations?: any;
  validationType?: "input" | "output" | "auth" | "model" | "context";
}

export interface ValidationContext {
  sanitizedMessages?: any[];
  lastMessage?: any;
  messageWithContext?: string;
  modelConfig?: any;
  guardrails?: any;
  selectedModels?: string[];
}

export interface ValidatorResult {
  validation: ValidationResult;
  context: ValidationContext;
}

export interface Validator {
  validate(
    options: CoreChatOptions,
    context: ValidationContext,
  ): Promise<ValidatorResult>;
}

export class ValidationPipeline {
  private validators: Validator[] = [
    new BasicInputValidator(),
    new AuthValidator(),
    new ModelConfigValidator(),
    new ContextLimitValidator(),
    new GuardrailsValidator(),
  ];

  async validate(
    options: CoreChatOptions,
    initialContext: ValidationContext = {},
  ): Promise<ValidatorResult> {
    let currentContext = initialContext;

    for (const validator of this.validators) {
      const result = await validator.validate(options, currentContext);

      if (!result?.validation?.isValid) {
        return {
          validation: result.validation,
          context: currentContext,
        };
      }

      currentContext = { ...currentContext, ...result.context };
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
    this.validators = this.validators.filter(
      (v) => !(v instanceof validatorClass),
    );
  }
}
