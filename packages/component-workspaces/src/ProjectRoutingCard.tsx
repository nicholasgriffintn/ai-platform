import { Button, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import {
  MODEL_TIER_DEFINITIONS,
  modelTierSchema,
  type ModelTier,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

const INHERITED_TIER_VALUE = "";

export interface ProjectRoutingCardProps {
  canManage: boolean;
  defaultModelTier: ModelTier | null;
  isSaving: boolean;
  errorMessage?: string;
  onSave: (tier: ModelTier | null) => Promise<void>;
}

function toSelectValue(tier: ModelTier | null) {
  return tier ?? INHERITED_TIER_VALUE;
}

function fromSelectValue(value: string): ModelTier | null {
  return value === INHERITED_TIER_VALUE ? null : modelTierSchema.parse(value);
}

export function ProjectRoutingCard({
  canManage,
  defaultModelTier,
  isSaving,
  errorMessage,
  onSave,
}: ProjectRoutingCardProps) {
  const [draft, setDraft] = useState<ModelTier | null | undefined>(undefined);
  const current = draft === undefined ? defaultModelTier : draft;

  return (
    <section className="space-y-3 border-t border-border p-5">
      <h2 className="text-sm font-semibold">Default model tier</h2>
      <p className="text-xs leading-5 text-muted-foreground">
        Project conversations and coding runs use this tier unless someone picks another tier or a
        specific model in the composer. This is not a spending limit.
      </p>
      <FormSelect
        label="Project default"
        value={toSelectValue(current)}
        disabled={!canManage || isSaving}
        options={[
          { value: INHERITED_TIER_VALUE, label: "Medium — the account default" },
          ...MODEL_TIER_DEFINITIONS.map((tier) => ({
            value: tier.id,
            label: `${tier.label} — ${tier.tagline}`,
          })),
        ]}
        onValueChange={(value) => setDraft(fromSelectValue(value))}
      />
      {errorMessage && (
        <p role="alert" className="text-sm text-failure">
          {errorMessage}
        </p>
      )}
      {canManage && draft !== undefined && draft !== defaultModelTier && (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={isSaving} onClick={() => setDraft(undefined)}>
            Cancel
          </Button>
          <Button
            isLoading={isSaving}
            onClick={() => {
              void onSave(draft)
                .then(() => setDraft(undefined))
                .catch(() => undefined);
            }}
          >
            Save preference
          </Button>
        </div>
      )}
    </section>
  );
}
