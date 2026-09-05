import { Badge, Button, FormInput, FormSelect, Switch } from "@ngriffin_uk/polychat-component-ui";
import {
  type ComposioTriggerType,
  formatRecipeTriggerIdentifier,
  type RecipeComposioTrigger,
  type RecipeConnectorProvider,
  type RecipeTriggerConfigurationField,
  type RecipeTriggerConfigurationValue,
} from "@ngriffin_uk/polychat-schemas";
import { PauseCircle, PlayCircle, Trash2 } from "lucide-react";

export interface RecipeEventTriggerProvider {
  id: RecipeConnectorProvider;
  name: string;
}

export function ConfigurationFields({
  fields,
  values,
  onChange,
}: {
  fields: RecipeTriggerConfigurationField[];
  values: Record<string, RecipeTriggerConfigurationValue>;
  onChange: (key: string, value: RecipeTriggerConfigurationValue) => void;
}) {
  return fields.map((field) => {
    if (field.type === "boolean") {
      return (
        <Switch
          key={field.key}
          id={`recipe-event-${field.key}`}
          label={field.label}
          description={field.description}
          checked={values[field.key] === true}
          onChange={(event) => onChange(field.key, event.target.checked)}
        />
      );
    }

    if (field.type === "select") {
      return (
        <FormSelect
          key={field.key}
          label={field.label}
          description={field.description}
          required={field.required}
          value={String(values[field.key] ?? "")}
          onChange={(event) => onChange(field.key, event.target.value)}
          options={(field.options ?? []).map((option) => ({ value: option, label: option }))}
        />
      );
    }

    return (
      <FormInput
        key={field.key}
        label={field.label}
        description={field.description}
        type={field.type === "number" ? "number" : "text"}
        required={field.required}
        value={String(values[field.key] ?? "")}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
    );
  });
}

export function TriggerList({
  triggers,
  triggerTypes,
  providers,
  onSetStatus,
  onDelete,
  isUpdating,
  isDeleting,
}: {
  triggers: RecipeComposioTrigger[];
  triggerTypes: ComposioTriggerType[];
  providers: RecipeEventTriggerProvider[];
  onSetStatus: (trigger: RecipeComposioTrigger, status: "active" | "paused") => void;
  onDelete: (trigger: RecipeComposioTrigger) => void;
  isUpdating: (trigger: RecipeComposioTrigger) => boolean;
  isDeleting: (trigger: RecipeComposioTrigger) => boolean;
}) {
  if (triggers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted-foreground">
        No event triggers yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {triggers.map((trigger) => {
        const provider = providers.find((candidate) => candidate.id === trigger.providerId);
        const triggerType = triggerTypes.find(
          (candidate) => candidate.slug === trigger.triggerSlug,
        );
        const eventName = triggerType?.name ?? formatRecipeTriggerIdentifier(trigger.triggerSlug);
        const active = trigger.status === "active";

        return (
          <li
            key={trigger.id}
            className="rounded-lg border border-border bg-surface-elevated/70 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{eventName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {provider?.name ?? "Connected integration"}
                </p>
              </div>
              <Badge variant={trigger.status === "error" ? "destructive" : "outline"}>
                {trigger.status === "error" ? "Needs attention" : active ? "Active" : "Paused"}
              </Badge>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="xs"
                icon={
                  active ? (
                    <PauseCircle className="h-3.5 w-3.5" />
                  ) : (
                    <PlayCircle className="h-3.5 w-3.5" />
                  )
                }
                onClick={() => onSetStatus(trigger, active ? "paused" : "active")}
                isLoading={isUpdating(trigger)}
              >
                {active ? "Pause" : "Resume"}
              </Button>
              <Button
                variant="outline"
                size="xs"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => onDelete(trigger)}
                isLoading={isDeleting(trigger)}
                aria-label={`Delete ${eventName} event trigger`}
              >
                Delete
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
