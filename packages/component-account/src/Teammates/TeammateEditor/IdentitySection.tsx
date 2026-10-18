import { FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import {
  describeTeammateKind,
  TEAMMATE_KINDS,
  TEAMMATE_PERMISSIONS_SENTENCE,
  teammateKindSchema,
} from "@ngriffin_uk/polychat-schemas";

import { TeammateCharacterPicker } from "./TeammateCharacterPicker";
import { TeammateEditorSection } from "./TeammateEditorSection";
import type { TeammateEditorChange, TeammateEditorValue } from "./types";

export interface IdentitySectionProps {
  value: Pick<TeammateEditorValue, "name" | "kind" | "description" | "avatarUrl" | "characterId">;
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
        onValueChange={(kind) =>
          onChange({ kind: teammateKindSchema.safeParse(kind).data ?? value.kind })
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
      <TeammateCharacterPicker
        value={value.characterId}
        disabled={disabled}
        onChange={(characterId) => onChange({ characterId })}
      />
      <FormInput
        label="Avatar URL"
        type="url"
        value={value.avatarUrl}
        disabled={disabled}
        placeholder="https://example.com/avatar.png"
        description="Optional. Used where no character is chosen, then the teammate's initial."
        onChange={(event) => onChange({ avatarUrl: event.target.value })}
      />
      <p className="text-xs text-muted-foreground">{TEAMMATE_PERMISSIONS_SENTENCE}</p>
    </TeammateEditorSection>
  );
}
