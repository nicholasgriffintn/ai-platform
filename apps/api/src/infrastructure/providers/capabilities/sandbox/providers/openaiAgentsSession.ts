import type {
  SandboxCredentialBrokerAccess,
  SandboxDeliveryPolicy,
  SandboxEnvironmentPreparationMode,
  SandboxEnvironmentSetup,
} from "@ngriffin_uk/polychat-schemas";

import { buildHostedSandboxExecutionPlan } from "../hostedSandboxExecution";

export function buildOpenAIAgentsSessionBody(params: {
  credentialBroker: SandboxCredentialBrokerAccess;
  model: string;
  repo: string;
  task: string;
  runId: string;
  deliveryPolicy: SandboxDeliveryPolicy;
  environmentSetup?: SandboxEnvironmentSetup;
  environmentPreparationMode?: SandboxEnvironmentPreparationMode;
}): Record<string, unknown> {
  const plan = buildHostedSandboxExecutionPlan(params);

  return {
    agent: {
      model: params.model,
      instructions: plan.instructions,
    },
    environment: {
      type: "openai_hosted",
      network: {
        access: "restricted",
        allowed_domains: plan.allowedDomains,
      },
      env: plan.environment,
      setup_commands: plan.setupCommands,
    },
    input: plan.input,
    stream: true,
  };
}
