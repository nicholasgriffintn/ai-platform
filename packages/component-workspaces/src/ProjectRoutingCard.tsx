import { Button, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import {
  AUTO_ROUTER_MODES,
  modelRouterModeSchema,
  type ModelRouterMode,
} from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export interface ProjectRoutingCardProps {
  canManage: boolean;
  defaultRouterMode: ModelRouterMode;
  isSaving: boolean;
  errorMessage?: string;
  onSave: (mode: ModelRouterMode) => Promise<void>;
}

export function ProjectRoutingCard({
  canManage,
  defaultRouterMode,
  isSaving,
  errorMessage,
  onSave,
}: ProjectRoutingCardProps) {
  const [draft, setDraft] = useState<ModelRouterMode | null>(null);

  return (
    <section className="space-y-3 border-t border-border p-5">
      <h2 className="text-sm font-semibold">Automatic model preference</h2>
      <p className="text-xs leading-5 text-muted-foreground">
        Auto uses this preference in project conversations. Choose another tier or a specific model
        in the composer to override it. This is not a spending limit.
      </p>
      <FormSelect
        label="Project default"
        value={draft ?? defaultRouterMode}
        disabled={!canManage || isSaving}
        options={AUTO_ROUTER_MODES.map((mode) => ({
          value: mode.id,
          label:
            mode.id === "auto" ? "Auto — no project preference" : `${mode.label} — ${mode.tagline}`,
        }))}
        onChange={(event) => setDraft(modelRouterModeSchema.parse(event.target.value))}
      />
      {errorMessage && (
        <p role="alert" className="text-sm text-failure">
          {errorMessage}
        </p>
      )}
      {canManage && draft !== null && draft !== defaultRouterMode && (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={isSaving} onClick={() => setDraft(null)}>
            Cancel
          </Button>
          <Button
            isLoading={isSaving}
            onClick={() => {
              void onSave(draft)
                .then(() => setDraft(null))
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
