import {
  getProviderCapabilities,
  type AgentWorkspaceRequirement,
  type ModelConfig,
  type ProviderDriver,
} from "@ngriffin_uk/polychat-schemas";

interface AgentCatalogueEntry {
  driver: ProviderDriver;
  name: string;
  description: string;
  workspace: AgentWorkspaceRequirement;
}

const AGENT_CATALOGUE: AgentCatalogueEntry[] = [
  {
    driver: "claude-code",
    name: "Claude Code",
    description: "Anthropic's coding agent for your workspace.",
    workspace: { kind: "directory" },
  },
  {
    driver: "codex",
    name: "Codex",
    description: "OpenAI's coding agent for your workspace.",
    workspace: { kind: "directory" },
  },
  {
    driver: "cursor",
    name: "Cursor",
    description: "Cursor's coding agent for your workspace.",
    workspace: { kind: "directory" },
  },
  {
    driver: "grok",
    name: "Grok",
    description: "xAI's coding agent for your workspace.",
    workspace: { kind: "directory" },
  },
  {
    driver: "opencode",
    name: "OpenCode",
    description: "An open coding agent for your workspace.",
    workspace: { kind: "directory" },
  },
  {
    driver: "antigravity",
    name: "Antigravity",
    description: "Google's coding agent for your workspace.",
    workspace: { kind: "directory" },
  },
  {
    driver: "polychat-sandbox",
    name: "Polychat Sandbox",
    description: "A disposable coding agent for a repository workspace.",
    workspace: { kind: "repository" },
  },
];

export const agentModelConfig: ModelConfig = Object.fromEntries(
  AGENT_CATALOGUE.map(({ driver, name, description, workspace }) => [
    `agent/${driver}`,
    {
      kind: "agent",
      matchingModel: driver,
      name,
      description,
      provider: driver,
      modalities: { input: ["text"], output: ["text"] },
      runsOn: "device",
      isFree: true,
      agent: {
        capabilities: getProviderCapabilities(driver),
        workspace,
        permissionModes: ["supervised", "auto_accept_edits", "auto", "full_access"],
      },
    },
  ]),
);
