import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import { Button, FormSelect, type FormSelectOption } from "@ngriffin_uk/polychat-component-ui";
import { formatProviderLabel, useAuthStatus, useModels } from "@ngriffin_uk/polychat-library-react";
import {
  getModelDisplayName,
  isLineupEligibleModel,
  MODEL_TIER_DEFINITIONS,
  modelTierSchema,
  type ModelConfig,
  type SystemModelOption,
} from "@ngriffin_uk/polychat-schemas";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { ModelChoicePicker } from "./ModelChoicePicker.js";

type ConversationSettingKey = "default_model_tier" | "default_model_id" | "sandbox_model";

const TIER_OPTIONS: FormSelectOption[] = [
  { value: "", label: "The standard tier" },
  ...MODEL_TIER_DEFINITIONS.map((tier) => ({
    value: tier.id,
    label: `${tier.label} - ${tier.tagline}`,
  })),
];

function toOptions(models: ModelConfig | undefined, hostedOnly: boolean): SystemModelOption[] {
  return Object.entries(models ?? {})
    .filter(
      ([, model]) =>
        model.isExecutable !== false &&
        isLineupEligibleModel(model) &&
        (!hostedOnly || (model.runsOn !== "device" && model.provider !== "web-llm")),
    )
    .map(([id, model]) => ({
      id,
      name: getModelDisplayName(model),
      provider: model.provider,
      ...(model.avatarUrl ? { avatarUrl: model.avatarUrl } : {}),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function SettingCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {children}
    </li>
  );
}

function ModelSetting({
  value,
  options,
  fallback,
  saving,
  onChange,
}: {
  value: string | null | undefined;
  options: readonly SystemModelOption[];
  fallback: string;
  saving: boolean;
  onChange: (modelId: string | null) => void;
}) {
  const chosen = value ? options.find((option) => option.id === value) : undefined;

  return (
    <div className="mt-auto flex flex-col gap-3">
      {value ? (
        <span className="flex min-w-0 items-center gap-2 rounded-lg border border-border px-3 py-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <ModelIcon
              url={chosen?.avatarUrl}
              modelName={chosen?.name ?? value}
              provider={chosen?.provider}
              size={16}
            />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">
              {chosen?.name ?? value}
            </span>
            <span className="block truncate font-mono text-[11px] text-muted-foreground">
              {chosen ? formatProviderLabel(chosen.provider) : "Not available to you any more"}
            </span>
          </span>
        </span>
      ) : (
        <p className="text-xs text-muted-foreground">{fallback}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <ModelChoicePicker
          label={value ? "Change model" : "Choose a model"}
          options={options.filter((option) => option.id !== value)}
          disabled={saving}
          onPick={(option) => onChange(option.id)}
        />
        {value && (
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => onChange(null)}>
            Follow the tier
          </Button>
        )}
      </div>
    </div>
  );
}

export function ConversationModelSettings() {
  const { userSettings, updateUserSettings, isUpdatingUserSettings } = useAuthStatus();
  const { data: models } = useModels();
  const chatOptions = toOptions(models, false);
  const sandboxOptions = toOptions(models, true);

  const save = (key: ConversationSettingKey, value: string | null) => {
    updateUserSettings({ [key]: value }).catch((error: unknown) =>
      toast.error("Couldn't save that choice", {
        description: error instanceof Error ? error.message : undefined,
      }),
    );
  };

  return (
    <section aria-labelledby="model-choices-conversations" className="space-y-3">
      <div className="space-y-1">
        <h2
          id="model-choices-conversations"
          className="font-display text-lg font-medium tracking-tight text-foreground"
        >
          Conversations and coding
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          What new conversations and sandbox coding runs start with. You can still switch model in
          the composer at any time.
        </p>
      </div>
      <ul className="grid gap-3 md:grid-cols-3">
        <SettingCard
          title="Default tier"
          description="New conversations pick the best model your plan can run in this tier."
        >
          <FormSelect
            value={userSettings?.default_model_tier ?? ""}
            options={TIER_OPTIONS}
            disabled={isUpdatingUserSettings}
            onValueChange={(value) => {
              const tier = modelTierSchema.safeParse(value);

              save("default_model_tier", tier.success ? tier.data : null);
            }}
          />
        </SettingCard>
        <SettingCard
          title="Default model"
          description="Start new conversations on one model instead of the tier."
        >
          <ModelSetting
            value={userSettings?.default_model_id}
            options={chatOptions}
            fallback="New conversations follow your default tier."
            saving={isUpdatingUserSettings}
            onChange={(modelId) => save("default_model_id", modelId)}
          />
        </SettingCard>
        <SettingCard
          title="Sandbox coding"
          description="The model for sandbox coding runs when a request doesn't name one."
        >
          <ModelSetting
            value={userSettings?.sandbox_model}
            options={sandboxOptions}
            fallback="Sandbox runs use the coding role of the project's tier."
            saving={isUpdatingUserSettings}
            onChange={(modelId) => save("sandbox_model", modelId)}
          />
        </SettingCard>
      </ul>
    </section>
  );
}
