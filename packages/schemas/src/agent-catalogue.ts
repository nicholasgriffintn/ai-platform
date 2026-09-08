import type { ModelConfig } from "./models.js";
import {
  getProviderCapabilities,
  type AgentWorkspaceRequirement,
  type ProviderDriver,
} from "./providers.js";

interface AgentCatalogueEntry {
  driver: ProviderDriver;
  name: string;
  description: string;
  workspace: AgentWorkspaceRequirement;
  runsOn: "device" | "server";
  permissionModes: Array<"supervised" | "auto_accept_edits" | "auto" | "full_access">;
}

const AGENT_CATALOGUE: AgentCatalogueEntry[] = [
  {
    driver: "claude-code",
    name: "Claude Code",
    description: "Anthropic's coding agent for your workspace.",
    workspace: { kind: "directory" },
    runsOn: "device",
    permissionModes: ["supervised", "auto_accept_edits", "auto", "full_access"],
  },
  {
    driver: "codex",
    name: "Codex",
    description: "OpenAI's coding agent for your workspace.",
    workspace: { kind: "directory" },
    runsOn: "device",
    permissionModes: ["supervised", "auto_accept_edits", "auto", "full_access"],
  },
  {
    driver: "cursor",
    name: "Cursor",
    description: "Cursor's coding agent for your workspace.",
    workspace: { kind: "directory" },
    runsOn: "device",
    permissionModes: ["supervised", "full_access"],
  },
  {
    driver: "grok",
    name: "Grok",
    description: "xAI's coding agent for your workspace.",
    workspace: { kind: "directory" },
    runsOn: "device",
    permissionModes: ["supervised", "auto"],
  },
  {
    driver: "opencode",
    name: "OpenCode",
    description: "An open coding agent for your workspace.",
    workspace: { kind: "directory" },
    runsOn: "device",
    permissionModes: ["supervised", "auto"],
  },
  {
    driver: "polychat-sandbox",
    name: "Polychat Sandbox",
    description: "A disposable coding agent for a repository workspace.",
    workspace: { kind: "repository" },
    runsOn: "server",
    permissionModes: ["supervised", "auto_accept_edits", "full_access"],
  },
];

export const agentModelConfig: ModelConfig = Object.fromEntries(
  AGENT_CATALOGUE.map(({ driver, name, description, workspace, runsOn, permissionModes }) => [
    `agent/${driver}`,
    {
      kind: "agent",
      matchingModel: driver,
      name,
      description,
      provider: driver,
      modalities: { input: ["text"], output: ["text"] },
      runsOn,
      isFree: driver !== "polychat-sandbox",
      agent: {
        capabilities: getProviderCapabilities(driver),
        workspace,
        permissionModes,
      },
    },
  ]),
);
