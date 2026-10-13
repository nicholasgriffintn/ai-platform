import { FormInput } from "@ngriffin_uk/polychat-component-ui";

import type { UserSettingsFormData } from "./user-settings";

const FIELDS = [
  {
    key: "bedrock_agent_runtime_arn",
    label: "AgentCore Runtime ARN",
    placeholder: "arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/polychat",
  },
  {
    key: "bedrock_agent_role_arn",
    label: "Session role ARN",
    placeholder: "arn:aws:iam::123456789012:role/bedrock-managed-agents",
  },
] as const;

export function BedrockManagedAgentSettings({
  settings,
  onChange,
}: {
  settings: UserSettingsFormData;
  onChange: (patch: Partial<UserSettingsFormData>) => void;
}) {
  return (
    <div className="space-y-4">
      {FIELDS.map(({ key, label, placeholder }) => (
        <FormInput
          key={key}
          id={key}
          name={key}
          label={label}
          placeholder={placeholder}
          value={settings[key] ?? ""}
          onChange={(event) => onChange({ [key]: event.target.value })}
        />
      ))}
      <p className="text-sm text-muted-foreground">
        Runs Bedrock Managed Agents in your own AWS account outside projects, using your Bedrock
        credentials from Providers. The role must be in the Runtime&apos;s account and trust Bedrock
        Managed Agents.
      </p>
    </div>
  );
}
