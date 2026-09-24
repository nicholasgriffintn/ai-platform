import z from "zod/v4";

export const sandboxRemoteExecutionProviderSchema = z.enum(["polychat", "openai"]);
export type SandboxRemoteExecutionProvider = z.infer<typeof sandboxRemoteExecutionProviderSchema>;
export const sandboxExecutionProviderSchema = z.enum(["polychat", "openai", "local"]);
export type SandboxExecutionProvider = z.infer<typeof sandboxExecutionProviderSchema>;

export interface SandboxProviderCapabilities {
  credentialBroker: boolean;
  environmentSetup: boolean;
  environmentCache: boolean;
  inspection: boolean;
  remoteDelivery: boolean;
  runControls: boolean;
}

export interface SandboxExecutionProviderDefinition {
  id: SandboxExecutionProvider;
  label: string;
  description: string;
  capabilities: SandboxProviderCapabilities;
}

export const DEFAULT_SANDBOX_EXECUTION_PROVIDER = "polychat" as const;
export const SANDBOX_EXECUTION_PROVIDER_DEFINITIONS = {
  polychat: {
    id: "polychat",
    label: "Polychat managed",
    description: "Full Work environment with caching, inspection, controls, and GitHub delivery.",
    capabilities: {
      credentialBroker: true,
      environmentSetup: true,
      environmentCache: true,
      inspection: true,
      remoteDelivery: true,
      runControls: true,
    },
  },
  openai: {
    id: "openai",
    label: "OpenAI hosted",
    description: "OpenAI-managed coding sandbox with GitHub delivery and project configuration.",
    capabilities: {
      credentialBroker: true,
      environmentSetup: true,
      environmentCache: false,
      inspection: false,
      remoteDelivery: true,
      runControls: false,
    },
  },
  local: {
    id: "local",
    label: "This device",
    description: "Run the coding sandbox in Docker on your desktop.",
    capabilities: {
      credentialBroker: true,
      environmentSetup: true,
      environmentCache: false,
      inspection: false,
      remoteDelivery: true,
      runControls: true,
    },
  },
} as const satisfies Record<SandboxExecutionProvider, SandboxExecutionProviderDefinition>;

export const SANDBOX_EXECUTION_PROVIDERS = Object.values(SANDBOX_EXECUTION_PROVIDER_DEFINITIONS);
export const SANDBOX_REMOTE_EXECUTION_PROVIDERS = [
  SANDBOX_EXECUTION_PROVIDER_DEFINITIONS.polychat,
  SANDBOX_EXECUTION_PROVIDER_DEFINITIONS.openai,
];

export function resolveSandboxExecutionProvider(value: unknown) {
  const parsed = sandboxExecutionProviderSchema.safeParse(value);

  return parsed.success ? parsed.data : DEFAULT_SANDBOX_EXECUTION_PROVIDER;
}
