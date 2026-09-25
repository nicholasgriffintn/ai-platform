export const UNKNOWN_ROUTE_REGION = "unknown";

export const PROVIDER_DEFAULT_REGIONS: Record<string, string> = {
  "together-ai": "us",
  fireworks: "us",
  deepinfra: "us",
  groq: "us",
  cerebras: "us",
  hyperbolic: "us",
  chutes: "global",
  huggingface: "us",
  replicate: "us",
  workers: "global",
  "workers-ai": "global",
  openrouter: "global",
  ovhcloud: "eu",
  "regolo-ai": "eu",
  greenpt: "eu",
  hetzner: "eu",
  mistral: "eu",
  "ollama-cloud": "global",
};

const AWS_REGION_AREAS: Array<[RegExp, string]> = [
  [/^eu-west-2$/, "uk"],
  [/^eu-/, "eu"],
  [/^us-/, "us"],
  [/^ap-/, "apac"],
  [/^ca-/, "ca"],
];

export function resolveProviderRegion(provider: string, cloudRegion?: string | null): string {
  if (cloudRegion) {
    return AWS_REGION_AREAS.find(([pattern]) => pattern.test(cloudRegion))?.[1] ?? cloudRegion;
  }

  return PROVIDER_DEFAULT_REGIONS[provider] ?? UNKNOWN_ROUTE_REGION;
}

export function matchesSourceReference(matchingModel: string, sourceRef: string): boolean {
  const normalisedMatch = matchingModel.toLowerCase().replace(/^hf:/, "");
  const normalisedRef = sourceRef.toLowerCase();

  return normalisedMatch === normalisedRef || normalisedMatch.endsWith(`/${normalisedRef}`);
}
