export type GuardrailSource = "INPUT" | "OUTPUT";

export interface GuardrailImage {
  url: string;
  detail?: "low" | "high";
}

export interface GuardrailContent {
  text: string;
  prompt?: string;
  images?: GuardrailImage[];
}

export type GuardrailInput = string | GuardrailContent;

export interface GuardrailsProvider {
  validateContent(content: GuardrailInput, source: GuardrailSource): Promise<GuardrailResult>;
}

export interface GuardrailConfig {
  bedrock: {
    guardrailId: string;
    guardrailVersion: string;
    region: string;
  };
  inputValidation: {
    maxLength: number;
  };
  outputValidation: {
    maxLength: number;
  };
}

export interface GuardrailResult {
  provider: string;
  isValid: boolean;
  violations: string[];
  rawResponse?: any;
}
