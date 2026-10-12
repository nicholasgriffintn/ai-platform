export interface AgentHostSpec {
  providerName: string;
  modelName: string;
  hostIdPrefix: string;
  sessionIdPrefix: string;
  displayName: string;
  approvalTool: string;
}

export const HERMES_AGENT_HOST_SPEC: AgentHostSpec = {
  providerName: "hermes",
  modelName: "hermes",
  hostIdPrefix: "hermes",
  sessionIdPrefix: "polychat",
  displayName: "Hermes",
  approvalTool: "request_approval",
};
