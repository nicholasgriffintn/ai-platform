import {
  desktopEndpointSchema,
  isSupportedEndpointUrl,
  type DesktopEndpointCandidate,
  type DesktopRuntimeReadiness,
  type ModelRuntimeVendor,
} from "@ngriffin_uk/polychat-schemas";

export interface KnownRuntimeCandidate {
  candidate: DesktopEndpointCandidate;
  description: string;
}

export const RUNTIME_VENDOR_OPTIONS: Array<{ value: ModelRuntimeVendor; label: string }> = [
  { value: "ollama", label: "Ollama" },
  { value: "lmstudio", label: "LM Studio" },
  { value: "llamacpp", label: "llama.cpp" },
];

export const KNOWN_RUNTIME_CANDIDATES: readonly KnownRuntimeCandidate[] = [
  {
    candidate: {
      id: "ollama-loopback",
      kind: "model",
      vendor: "ollama",
      label: "Ollama",
      url: "http://127.0.0.1:11434",
      transport: "loopback",
    },
    description: "Local models served by Ollama.",
  },
  {
    candidate: {
      id: "lmstudio-loopback",
      kind: "model",
      vendor: "lmstudio",
      label: "LM Studio",
      url: "http://127.0.0.1:1234",
      transport: "loopback",
    },
    description: "Local models served by LM Studio.",
  },
  {
    candidate: {
      id: "llamacpp-loopback",
      kind: "model",
      vendor: "llamacpp",
      label: "llama.cpp",
      url: "http://127.0.0.1:8080",
      transport: "loopback",
    },
    description: "Local models served by llama.cpp.",
  },
];

export function runtimeVendorLabel(vendor: string): string {
  return RUNTIME_VENDOR_OPTIONS.find((option) => option.value === vendor)?.label ?? vendor;
}

export function buildCustomRuntimeCandidate(input: {
  vendor: ModelRuntimeVendor;
  label: string;
  url: string;
  transport: "loopback" | "network";
}): DesktopEndpointCandidate {
  const url = input.url.trim();
  let host = "runtime";
  let port = "";

  try {
    const parsed = new URL(url);

    host = parsed.hostname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || host;
    port = parsed.port;
  } catch {
    host = "runtime";
  }

  return {
    id: `${input.vendor}-${host}${port ? `-${port}` : ""}`.slice(0, 120),
    kind: "model",
    vendor: input.vendor,
    label: input.label.trim() || runtimeVendorLabel(input.vendor),
    url,
    transport: input.transport,
  };
}

export function validateRuntimeCandidate(candidate: DesktopEndpointCandidate): string | null {
  if (!isSupportedEndpointUrl(candidate.url)) {
    return "Enter an HTTP or HTTPS runtime address.";
  }

  const result = desktopEndpointSchema.safeParse({
    ...candidate,
    pairingSecretStored: Boolean(candidate.pairingSecret),
    approvedAt: new Date(0).toISOString(),
    lastSeenAt: null,
  });

  return result.success ? null : (result.error.issues[0]?.message ?? "The runtime is not valid.");
}

export function readinessLabel(readiness: DesktopRuntimeReadiness): string {
  switch (readiness.status) {
    case "ready":
      return "Ready";
    case "unauthorised":
      return "Needs authorisation";
    case "unreachable":
      return "Not reachable";
  }

  return "Unknown runtime";
}

export function readinessDetail(readiness: DesktopRuntimeReadiness): string {
  switch (readiness.status) {
    case "ready":
      return "The runtime answered successfully.";
    case "unauthorised":
      return readiness.detail ?? "The runtime rejected the request.";
    case "unreachable":
      return readiness.detail ?? "The runtime did not answer.";
  }

  return "The runtime returned an unknown status.";
}
