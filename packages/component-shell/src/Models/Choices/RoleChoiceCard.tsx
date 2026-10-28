import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import { Badge, Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { formatProviderLabel } from "@ngriffin_uk/polychat-library-react";
import {
  SYSTEM_MODEL_CHOICE_LIMIT,
  type SystemModelChoice,
  type SystemModelChoiceView,
  type SystemModelOption,
  type SystemModelRoleDefinition,
  type SystemModelRoleView,
} from "@ngriffin_uk/polychat-schemas";
import { moveCopy } from "@ngriffin_uk/polychat-utility-core";
import { ArrowDown, ArrowUp, X } from "lucide-react";

import { ModelChoicePicker } from "./ModelChoicePicker.js";

const STATUS_BADGES = {
  retired: { label: "Retired", variant: "failure" },
  unavailable: { label: "Not available to you", variant: "warning" },
} as const;

const SOURCE_LABELS = {
  workspace: "Workspace choice",
  user: "Your choice",
  platform: "Platform default",
} as const;

export interface RoleChoiceCardProps {
  definition: SystemModelRoleDefinition;
  view: SystemModelRoleView;
  models: Record<string, SystemModelOption>;
  editable: boolean;
  saving: boolean;
  onChange: (choices: SystemModelChoice[]) => void;
}

function toChoices(views: readonly SystemModelChoiceView[]): SystemModelChoice[] {
  return views.map(({ model, provider }) => ({ model, provider }));
}

function ChoiceName({
  choice,
  models,
}: {
  choice: SystemModelChoiceView;
  models: Record<string, SystemModelOption>;
}) {
  const option = choice.id ? models[choice.id] : undefined;
  const name = option?.name ?? choice.model;
  const provider = option?.provider ?? choice.provider;

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <ModelIcon url={option?.avatarUrl} modelName={name} provider={provider} size={16} />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate text-sm font-medium text-foreground",
            choice.status === "retired" && "text-muted-foreground line-through",
          )}
        >
          {name}
        </span>
        <span className="block truncate font-mono text-[11px] text-muted-foreground">
          {formatProviderLabel(provider)}
        </span>
      </span>
    </span>
  );
}

function DefaultsLine({
  view,
  models,
}: {
  view: SystemModelRoleView;
  models: Record<string, SystemModelOption>;
}) {
  if (view.defaults.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        There is no platform default for this job, so it stays off until you choose a model.
      </p>
    );
  }

  const names = view.defaults.map(
    (entry) => (entry.id ? models[entry.id]?.name : null) ?? entry.model,
  );

  return (
    <p className="text-xs text-muted-foreground">
      {view.choices.length > 0 ? "If none of these can run: " : "Platform default: "}
      <span className="text-foreground">{names.join(", then ")}</span> on Workers AI.
    </p>
  );
}

export function RoleChoiceCard({
  definition,
  view,
  models,
  editable,
  saving,
  onChange,
}: RoleChoiceCardProps) {
  const choices = toChoices(view.choices);
  const chosenIds = new Set(view.choices.flatMap((choice) => (choice.id ? [choice.id] : [])));
  const options = view.options.flatMap((id) => {
    const option = models[id];

    return option && !chosenIds.has(id) ? [option] : [];
  });
  const active = view.active ? models[view.active.id] : undefined;
  const canAdd = editable && choices.length < SYSTEM_MODEL_CHOICE_LIMIT;

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{definition.label}</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{definition.description}</p>
        </div>
        {view.active && (
          <Badge
            variant={view.active.source === "platform" ? "muted" : "info"}
            className="shrink-0"
          >
            {SOURCE_LABELS[view.active.source]}
          </Badge>
        )}
      </div>

      {view.choices.length > 0 && (
        <ol aria-label={`${definition.label} choices`} className="grid gap-2">
          {view.choices.map((choice, index) => {
            const status = choice.status === "ready" ? null : STATUS_BADGES[choice.status];

            return (
              <li
                key={`${choice.provider}:${choice.model}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <ChoiceName choice={choice} models={models} />
                  <span className="flex flex-wrap gap-1 pl-7">
                    <Badge variant="outline" className="text-[10px]">
                      {index === 0 ? "First choice" : `Fallback ${index}`}
                    </Badge>
                    {status && (
                      <Badge variant={status.variant} className="text-[10px]">
                        {status.label}
                      </Badge>
                    )}
                  </span>
                </div>
                {editable && (
                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="icon"
                      size="icon"
                      aria-label={`Move ${choice.model} up`}
                      disabled={saving || index === 0}
                      onClick={() => onChange(moveCopy(choices, index, index - 1))}
                      icon={<ArrowUp className="h-3.5 w-3.5" />}
                    />
                    <Button
                      variant="icon"
                      size="icon"
                      aria-label={`Move ${choice.model} down`}
                      disabled={saving || index === choices.length - 1}
                      onClick={() => onChange(moveCopy(choices, index, index + 1))}
                      icon={<ArrowDown className="h-3.5 w-3.5" />}
                    />
                    <Button
                      variant="icon"
                      size="icon"
                      aria-label={`Remove ${choice.model}`}
                      disabled={saving}
                      onClick={() => onChange(choices.filter((_, position) => position !== index))}
                      icon={<X className="h-3.5 w-3.5" />}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-auto flex flex-col gap-3">
        <DefaultsLine view={view} models={models} />
        {active ? (
          <p className="text-xs text-muted-foreground">
            Running now: <span className="text-foreground">{active.name}</span>
          </p>
        ) : (
          <p className="text-xs text-attention">Nothing can run this job on your account yet.</p>
        )}
        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            <ModelChoicePicker
              label={choices.length === 0 ? "Choose a model" : "Add a fallback"}
              options={options}
              disabled={saving || !canAdd}
              onPick={(option) =>
                onChange([...choices, { model: option.id, provider: option.provider }])
              }
            />
            {choices.length > 0 && (
              <Button variant="ghost" size="sm" disabled={saving} onClick={() => onChange([])}>
                Use the platform default
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
