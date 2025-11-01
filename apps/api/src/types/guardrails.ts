export interface GuardrailsProvider {
  validateContent(
    content: string,
    source: "INPUT" | "OUTPUT",
  ): Promise<GuardrailResult>;
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
