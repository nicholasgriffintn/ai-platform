import { FormInput } from "@ngriffin_uk/polychat-component-ui";

import { AgentEditorSection } from "./AgentEditorSection";
import type { AgentEditorChange, AgentEditorValue } from "./types";

export interface IdentitySectionProps {
  value: Pick<AgentEditorValue, "name" | "description" | "avatarUrl">;
  disabled: boolean;
  onChange: AgentEditorChange;
}

export function IdentitySection({ value, disabled, onChange }: IdentitySectionProps) {
  return (
    <AgentEditorSection
      title="Identity"
      description="How this agent introduces itself wherever someone picks it."
    >
      <FormInput
        label="Name"
        value={value.name}
        disabled={disabled}
        required
        placeholder="Research assistant"
        onChange={(event) => onChange({ name: event.target.value })}
      />
      <FormInput
        label="Description"
        value={value.description}
        disabled={disabled}
        placeholder="Digs through sources and comes back with citations"
        description="Shown next to the agent in chat and in the capability library."
        onChange={(event) => onChange({ description: event.target.value })}
      />
      <FormInput
        label="Avatar URL"
        type="url"
        value={value.avatarUrl}
        disabled={disabled}
        placeholder="https://example.com/avatar.png"
        description="Optional. Falls back to the agent's initial."
        onChange={(event) => onChange({ avatarUrl: event.target.value })}
      />
    </AgentEditorSection>
  );
}
