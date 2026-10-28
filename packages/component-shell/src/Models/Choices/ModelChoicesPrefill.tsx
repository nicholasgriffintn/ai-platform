import {
  Button,
  FormSelect,
  SegmentedControl,
  type FormSelectOption,
} from "@ngriffin_uk/polychat-component-ui";
import { formatProviderLabel, useSuggestModelChoices } from "@ngriffin_uk/polychat-library-react";
import {
  SYSTEM_MODEL_LINEUP,
  type SystemModelChoices,
  type SystemModelOption,
  type SystemModelPriority,
  type SystemModelSuggestionsResponse,
} from "@ngriffin_uk/polychat-schemas";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PRIORITY_OPTIONS = [
  { id: "value", label: "Best value" },
  { id: "quality", label: "Best results" },
] as const;

export interface ModelChoicesPrefillProps {
  workspaceId?: string;
  models: Record<string, SystemModelOption>;
  providers: readonly string[];
  applying: boolean;
  onApply: (choices: SystemModelChoices) => Promise<unknown>;
}

function toChoices(response: SystemModelSuggestionsResponse): SystemModelChoices {
  return Object.fromEntries(
    response.suggestions.map((suggestion) => [suggestion.role, suggestion.choices]),
  );
}

export function ModelChoicesPrefill({
  workspaceId,
  models,
  providers,
  applying,
  onApply,
}: ModelChoicesPrefillProps) {
  const [provider, setProvider] = useState("");
  const [priority, setPriority] = useState<SystemModelPriority>("value");
  const suggest = useSuggestModelChoices(workspaceId);
  const preview = suggest.data;
  const providerOptions: FormSelectOption[] = [
    { value: "", label: "Any provider" },
    ...providers.map((id) => ({ value: id, label: formatProviderLabel(id) })),
  ];

  const run = (next: { provider?: string; priority?: SystemModelPriority }) => {
    const resolvedProvider = next.provider ?? provider;

    suggest.mutate(
      {
        priority: next.priority ?? priority,
        ...(resolvedProvider ? { provider: resolvedProvider } : {}),
      },
      {
        onError: (error) =>
          toast.error("Couldn't work out suggestions", { description: error.message }),
      },
    );
  };

  return (
    <section
      aria-labelledby="model-choices-prefill"
      className="space-y-4 rounded-xl border border-border bg-surface p-4"
    >
      <div className="space-y-1">
        <h2
          id="model-choices-prefill"
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-active-work" aria-hidden="true" />
          Fill these in for me
        </h2>
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Ranks the models you can run for each job by the benchmark that suits it: reasoning for
          writing, context for summaries, arena scores for pictures and voice, and cost for small
          checks. Nothing changes until you apply it.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex w-full flex-col gap-1.5 sm:w-56">
          <span className="text-xs font-medium text-muted-foreground">Prefer models from</span>
          <FormSelect
            value={provider}
            options={providerOptions}
            disabled={suggest.isPending}
            fullWidth
            onValueChange={(value) => {
              setProvider(value);

              if (preview) {
                run({ provider: value });
              }
            }}
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Optimise for</span>
          <SegmentedControl
            label="Optimise for"
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={(value) => {
              setPriority(value);

              if (preview) {
                run({ priority: value });
              }
            }}
          />
        </div>
        <Button
          size="sm"
          variant="secondary"
          isLoading={suggest.isPending}
          onClick={() => run({})}
          className="sm:ml-auto"
        >
          {preview ? "Refresh" : "Suggest choices"}
        </Button>
      </div>

      {preview && (
        <div className="space-y-3 border-t border-border pt-4">
          {preview.suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {provider
                ? `${formatProviderLabel(provider)} has nothing for these jobs on your account.`
                : "Nothing on your account can do these jobs yet."}
            </p>
          ) : (
            <ul aria-label="Suggested choices" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {preview.suggestions.map((suggestion) => (
                <li key={suggestion.role} className="rounded-lg border border-border px-3 py-2">
                  <p className="text-xs font-semibold text-foreground">
                    {SYSTEM_MODEL_LINEUP.find((definition) => definition.id === suggestion.role)
                      ?.label ?? suggestion.role}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {suggestion.choices
                      .map((choice) => models[choice.model]?.name ?? choice.model)
                      .join(", then ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            {provider
              ? "Jobs that provider can't do keep their current choices, and the platform defaults still back everything."
              : "The platform defaults on Workers AI still back every job."}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={applying || preview.suggestions.length === 0}
              isLoading={applying}
              onClick={() => {
                void onApply(toChoices(preview)).then(() => suggest.reset());
              }}
            >
              Apply {preview.suggestions.length === 1 ? "this" : "these"}
            </Button>
            <Button size="sm" variant="ghost" disabled={applying} onClick={() => suggest.reset()}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
