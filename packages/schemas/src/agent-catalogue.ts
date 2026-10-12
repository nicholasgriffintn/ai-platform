import {
  AGENT_HARNESS_DEFINITIONS,
  AGENT_HARNESS_PROVIDER,
  type AgentHarnessDefinition,
  type AgentHarnessId,
} from "./agent-harness.js";
import { agentModelId } from "./agent-model-id.js";
import type { ModelConfig, ModelConfigItem } from "./models.js";
import {
  getProviderCapabilities,
  type AgentWorkspaceRequirement,
  type ProviderCapabilities,
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
    permissionModes: ["auto_accept_edits", "auto", "full_access"],
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
    permissionModes: ["full_access"],
  },
  {
    driver: "grok",
    name: "Grok",
    description: "xAI's coding agent for your workspace.",
    workspace: { kind: "directory" },
    runsOn: "device",
    permissionModes: ["auto"],
  },
  {
    driver: "opencode",
    name: "OpenCode",
    description: "An open coding agent for your workspace.",
    workspace: { kind: "directory" },
    runsOn: "device",
    permissionModes: ["auto"],
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

export function agentHarnessModelId(harness: AgentHarnessId): string {
  return agentModelId(`harness-${harness}`);
}

function harnessCapabilities(definition: AgentHarnessDefinition): ProviderCapabilities {
  const actsOnFiles =
    definition.capabilities.workspaceTools || definition.capabilities.ownsEnvironment;

  return {
    streamsText: true,
    streamsReasoning: true,
    picksOwnModel: definition.runtime === "remote",
    listsModels: false,
    writesFiles: actsOnFiles,
    runsCommands: actsOnFiles,
    reportsApprovals: definition.capabilities.approvals,
    autoReview: false,
    resumesSessions: true,
    checkpoints: false,
    rollsBack: false,
    runsUnattended: true,
  };
}

function harnessModelConfig(definition: AgentHarnessDefinition): ModelConfigItem {
  return {
    kind: "agent",
    matchingModel: definition.id,
    name: definition.name,
    description: definition.description,
    provider: AGENT_HARNESS_PROVIDER,
    modalities: { input: ["text"], output: ["text"] },
    runsOn: "server",
    isFree: false,
    agent: {
      capabilities: harnessCapabilities(definition),
      workspace: { kind: "none" },
      permissionModes: definition.permissionModes,
    },
  };
}

export const agentModelConfig: ModelConfig = {
  ...Object.fromEntries(
    AGENT_CATALOGUE.map(({ driver, name, description, workspace, runsOn, permissionModes }) => [
      agentModelId(driver),
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
      } satisfies ModelConfigItem,
    ]),
  ),
  ...Object.fromEntries(
    Object.values(AGENT_HARNESS_DEFINITIONS).map((definition) => [
      agentHarnessModelId(definition.id),
      harnessModelConfig(definition),
    ]),
  ),
};
