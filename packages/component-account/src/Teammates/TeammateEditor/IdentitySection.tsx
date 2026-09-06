import { FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import {
  describeTeammateKind,
  TEAMMATE_KINDS,
  TEAMMATE_PERMISSIONS_SENTENCE,
  teammateKindSchema,
} from "@ngriffin_uk/polychat-schemas";

import { TeammateEditorSection } from "./TeammateEditorSection";
import type { TeammateEditorChange, TeammateEditorValue } from "./types";

export interface IdentitySectionProps {
  value: Pick<TeammateEditorValue, "name" | "kind" | "description" | "avatarUrl">;
  disabled: boolean;
  onChange: TeammateEditorChange;
}

const KIND_LABELS: Record<(typeof TEAMMATE_KINDS)[number], string> = {
  colleague: "Colleague",
  bot: "Bot",
};

export function IdentitySection({ value, disabled, onChange }: IdentitySectionProps) {
  return (
    <TeammateEditorSection
      title="Identity"
      description="How this teammate introduces itself wherever someone picks it."
    >
      <FormInput
        label="Name"
        value={value.name}
        disabled={disabled}
        required
        placeholder="Research assistant"
        onChange={(event) => onChange({ name: event.target.value })}
      />
      <FormSelect
        label="Kind"
        value={value.kind}
        disabled={disabled}
        options={TEAMMATE_KINDS.map((kind) => ({ value: kind, label: KIND_LABELS[kind] }))}
        description={describeTeammateKind(value.kind)}
        onChange={(event) =>
          onChange({ kind: teammateKindSchema.safeParse(event.target.value).data ?? value.kind })
        }
      />
      <FormInput
        label="Description"
        value={value.description}
        disabled={disabled}
        placeholder="Digs through sources and comes back with citations"
        description="Shown next to the teammate in chat and in the library."
        onChange={(event) => onChange({ description: event.target.value })}
      />
      <FormInput
        label="Avatar URL"
        type="url"
        value={value.avatarUrl}
        disabled={disabled}
        placeholder="https://example.com/avatar.png"
        description="Optional. Falls back to the teammate's initial."
        onChange={(event) => onChange({ avatarUrl: event.target.value })}
      />
      <p className="text-muted-foreground text-xs">{TEAMMATE_PERMISSIONS_SENTENCE}</p>
    </TeammateEditorSection>
  );
}
