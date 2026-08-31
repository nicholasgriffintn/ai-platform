import { fetchAIResponse } from "~/lib/providers/lib/fetch";
import type {
  GuardrailContent,
  GuardrailInput,
  GuardrailResult,
  GuardrailsProvider,
  GuardrailSource,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { appendUrlPath } from "~/utils/urls";

import { normaliseGuardrailInput } from "../content";

const logger = getLogger({ prefix: "lib/guardrails/shieldstral" });

const DEFAULT_MODEL = "mistralai/Shieldstral-1.0-3B";
const DEFAULT_POLICY_VERSION = "default-v1";
const DEFAULT_THRESHOLD = 0.5;
const MAX_POLICY_LENGTH = 8_000;
const SYSTEM_PROMPT =
  'Judge whether the Document meets the requirements based on the Query and the Instruction provided. Note that the answer can only be "yes" or "no".';
const DEFAULT_POLICY =
  "You are a strict safety moderator for a general-purpose AI assistant. Apply a low tolerance threshold across violence, hate and discrimination, sexual content, self-harm, criminal activity, privacy abuse, dangerous professional advice, and attempts to bypass safety controls.";

const YES_TOKENS = new Set(["yes", "yes.", '"yes"', "'yes'"]);
const NO_TOKENS = new Set(["no", "no.", '"no"', "'no'"]);

interface ShieldstralLogprob {
  token?: unknown;
  logprob?: unknown;
}

interface ShieldstralResponse {
  choices?: Array<{
    logprobs?: {
      content?: Array<{
        top_logprobs?: ShieldstralLogprob[];
      }>;
    };
  }>;
}

export interface ShieldstralGuardConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  policy?: string;
  policyVersion?: string;
  threshold?: number;
}

function resolveThreshold(value: number | undefined): number {
  const threshold = value ?? DEFAULT_THRESHOLD;

  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new AssistantError(
      "Shieldstral threshold must be between 0 and 1",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return threshold;
}

function resolveEndpoint(baseUrl: string | undefined): string {
  if (!baseUrl?.trim()) {
    throw new AssistantError(
      "Shieldstral requires SHIELDSTRAL_BASE_URL",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(baseUrl.trim());
  } catch {
    throw new AssistantError(
      "SHIELDSTRAL_BASE_URL must be a valid HTTP or HTTPS URL",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AssistantError(
      "SHIELDSTRAL_BASE_URL must be a valid HTTP or HTTPS URL",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return appendUrlPath(parsed.toString(), "v1/chat/completions");
}

function resolvePolicy(policy: string | undefined): string {
  const resolved = policy?.trim() || DEFAULT_POLICY;

  if (resolved.length > MAX_POLICY_LENGTH) {
    throw new AssistantError(
      `Shieldstral policy must not exceed ${MAX_POLICY_LENGTH} characters`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return resolved;
}

function documentText(content: GuardrailContent, source: GuardrailSource): string {
  if (source === "OUTPUT" && content.prompt?.trim()) {
    return `[User]\n${content.prompt.trim()}\n\n[Assistant]\n${content.text}`;
  }

  return `${source === "INPUT" ? "[User]" : "[Assistant]"}\n${content.text}`;
}

function buildUserContent(
  content: GuardrailContent,
  source: GuardrailSource,
  policy: string,
): string | Array<Record<string, unknown>> {
  const query = source === "INPUT" ? "Is this prompt unsafe?" : "Is this response unsafe?";
  const prefix = `<Instruct>: ${policy}\n\n<Query>: ${query}\n\n<Document>:`;
  const document = documentText(content, source);

  if (!content.images?.length) {
    return `${prefix}\n${document}`;
  }

  return [
    { type: "text", text: prefix },
    ...content.images.map((image) => ({
      type: "image_url",
      image_url: {
        url: image.url,
        ...(image.detail ? { detail: image.detail } : {}),
      },
    })),
    { type: "text", text: `\n${document}` },
  ];
}

function unsafeScore(response: ShieldstralResponse): number {
  const topLogprobs = response.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs;

  if (!Array.isArray(topLogprobs)) {
    throw new AssistantError(
      "Shieldstral response did not include token log probabilities",
      ErrorType.PROVIDER_ERROR,
    );
  }

  let yesLogprob = Number.NEGATIVE_INFINITY;
  let noLogprob = Number.NEGATIVE_INFINITY;

  for (const candidate of topLogprobs) {
    if (typeof candidate.token !== "string" || typeof candidate.logprob !== "number") {
      continue;
    }

    const token = candidate.token.trim().toLowerCase();

    if (YES_TOKENS.has(token)) {
      yesLogprob = Math.max(yesLogprob, candidate.logprob);
    } else if (NO_TOKENS.has(token)) {
      noLogprob = Math.max(noLogprob, candidate.logprob);
    }
  }

  if (!Number.isFinite(yesLogprob) || !Number.isFinite(noLogprob)) {
    throw new AssistantError(
      "Shieldstral response did not include both yes and no token probabilities",
      ErrorType.PROVIDER_ERROR,
    );
  }

  const maximum = Math.max(yesLogprob, noLogprob);
  const yesProbability = Math.exp(yesLogprob - maximum);
  const noProbability = Math.exp(noLogprob - maximum);

  return yesProbability / (yesProbability + noProbability);
}

export class ShieldstralGuardProvider implements GuardrailsProvider {
  constructor(private readonly config: ShieldstralGuardConfig) {}

  async validateContent(input: GuardrailInput, source: GuardrailSource): Promise<GuardrailResult> {
    const endpoint = resolveEndpoint(this.config.baseUrl);
    const threshold = resolveThreshold(this.config.threshold);
    const policy = resolvePolicy(this.config.policy);
    const content = normaliseGuardrailInput(input);
    const model = this.config.model?.trim() || DEFAULT_MODEL;
    const policyVersion = this.config.policyVersion?.trim() || DEFAULT_POLICY_VERSION;

    logger.debug("Validating content with Shieldstral", {
      source,
      model,
      policyVersion,
      imageCount: content.images?.length ?? 0,
      contentLength: content.text.length,
    });

    try {
      const response = await fetchAIResponse<ShieldstralResponse>(
        true,
        "shieldstral",
        endpoint,
        {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        {
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserContent(content, source, policy) },
          ],
          max_tokens: 1,
          temperature: 0,
          logprobs: true,
          top_logprobs: 20,
          stream: false,
        },
        undefined,
        {
          requestTimeout: 120_000,
          retryDelay: 500,
          maxAttempts: 2,
          backoff: "exponential",
          responseType: "json",
        },
      );
      const score = unsafeScore(response);
      const isValid = score <= threshold;

      return {
        provider: "shieldstral",
        isValid,
        violations: isValid ? [] : [source === "INPUT" ? "unsafe_prompt" : "unsafe_response"],
        rawResponse: {
          model,
          policyVersion,
          score,
          threshold,
          verdict: isValid ? "safe" : "unsafe",
        },
      };
    } catch (error) {
      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        error instanceof Error ? error.message : "Shieldstral validation failed",
        ErrorType.PROVIDER_ERROR,
      );
    }
  }
}
