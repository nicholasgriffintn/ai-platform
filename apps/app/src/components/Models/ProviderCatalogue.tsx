import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  SearchInput,
  Skeleton,
} from "@ngriffin_uk/polychat-component-ui";
import { filterModelsByQuery, type ModelProviderGroup } from "@ngriffin_uk/polychat-library-react";
import { getModelDisplayName, type ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { formatCompactCount } from "@ngriffin_uk/polychat-utility-core";
import { useDeferredValue, useMemo, useState } from "react";

import { MODELS_SECTIONS } from "~/components/Models/models-sections";
import { ModelsSection } from "~/components/Models/ModelsSection";
import { ProviderMark } from "~/components/Models/ProviderMark";

const PROVIDER_PREVIEW_LIMIT = 9;

function ModelCard({ model }: { model: ModelConfigItem }) {
  const name = getModelDisplayName(model);
  const inputs = model.modalities?.input ?? [];
  const contextWindow = model.contextWindow ?? model.context_length;

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-foreground">
          <ModelIcon url={model.avatarUrl} modelName={name} provider={model.provider} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium break-words text-foreground">{name}</span>
            {model.isFeatured && <Badge variant="info">Featured</Badge>}
            {model.isFree && <Badge variant="success">Free</Badge>}
            {model.status === "beta" && <Badge variant="warning">Beta</Badge>}
            {model.status === "alpha" && <Badge variant="warning">Alpha</Badge>}
            {model.openWeights && <Badge variant="outline">Open weights</Badge>}
          </div>
          {model.description && (
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
              {model.description}
            </p>
          )}
        </div>
      </div>
      {(inputs.length > 0 || contextWindow) && (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          {inputs.length > 0 && (
            <div className="flex gap-1.5">
              <dt className="uppercase">In</dt>
              <dd>{inputs.join(" · ")}</dd>
            </div>
          )}
          {contextWindow && (
            <div className="flex gap-1.5">
              <dt className="uppercase">Context</dt>
              <dd>{formatCompactCount(contextWindow)} tokens</dd>
            </div>
          )}
        </dl>
      )}
    </li>
  );
}

function ModelGrid({ models, label }: { models: ModelConfigItem[]; label: string }) {
  return (
    <ul aria-label={label} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {models.map((model) => (
        <ModelCard key={model.matchingModel} model={model} />
      ))}
    </ul>
  );
}

function ProviderModelsDialog({
  group,
  open,
  onOpenChange,
}: {
  group: ModelProviderGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const matches = useMemo(
    () => filterModelsByQuery(group.models, deferredQuery),
    [group.models, deferredQuery],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} width="min(72rem, 94vw)">
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl font-medium tracking-tight">
            <ProviderMark provider={group.provider} size={20} />
            {group.label}
          </DialogTitle>
          <DialogDescription>
            {group.models.length} models. Search by name, family or what they take in.
          </DialogDescription>
        </DialogHeader>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={`Search ${group.label} models`}
          aria-label={`Search ${group.label} models`}
        />
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {matches.length > 0 ? (
            <ModelGrid models={matches} label={`${group.label} models`} />
          ) : (
            <EmptyState
              title="Nothing on that perch"
              message="No model matches that search. Try a shorter name."
              className="min-h-[160px]"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProviderGroup({ group }: { group: ModelProviderGroup }) {
  const headingId = `models-provider-${group.provider}-title`;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const hasOverflow = group.models.length > PROVIDER_PREVIEW_LIMIT;
  const preview = hasOverflow ? group.models.slice(0, PROVIDER_PREVIEW_LIMIT) : group.models;

  return (
    <section
      id={`provider-${group.provider}`}
      aria-labelledby={headingId}
      className="scroll-mt-20 space-y-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-foreground">
            <ProviderMark provider={group.provider} size={18} />
          </span>
          <h3
            id={headingId}
            className="truncate font-display text-xl font-medium tracking-tight text-foreground"
          >
            {group.label}
          </h3>
        </div>
        <span className="polychat-eyebrow shrink-0 text-right">
          {group.models.length} {group.models.length === 1 ? "model" : "models"}
        </span>
      </div>
      <ModelGrid models={preview} label={`${group.label} models`} />
      {hasOverflow && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              Showing the first {PROVIDER_PREVIEW_LIMIT} of {group.models.length}.
            </span>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setIsDialogOpen(true)}
            >
              Show all {group.models.length} {group.label} models
            </Button>
          </div>
          <ProviderModelsDialog group={group} open={isDialogOpen} onOpenChange={setIsDialogOpen} />
        </>
      )}
    </section>
  );
}

function ProviderFilter({
  groups,
  selected,
  onSelect,
}: {
  groups: ModelProviderGroup[];
  selected: string | null;
  onSelect: (provider: string | null) => void;
}) {
  const chipClass = (isActive: boolean) =>
    cn(
      "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      isActive
        ? "border-active-work bg-selection text-foreground"
        : "border-border bg-surface text-foreground hover:border-border-strong",
    );

  return (
    <div role="group" aria-label="Filter by provider" className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={selected === null}
        className={chipClass(selected === null)}
        onClick={() => onSelect(null)}
      >
        All providers
      </button>
      {groups.map((group) => {
        const isActive = selected === group.provider;

        return (
          <button
            key={group.provider}
            type="button"
            aria-pressed={isActive}
            className={chipClass(isActive)}
            onClick={() => onSelect(isActive ? null : group.provider)}
          >
            <ProviderMark provider={group.provider} size={12} />
            {group.label}
            <span className="font-mono text-muted-foreground">{group.models.length}</span>
          </button>
        );
      })}
    </div>
  );
}

function CatalogueSkeleton() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading models">
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index}>
          <Skeleton className="h-28 w-full rounded-xl" />
        </li>
      ))}
    </ul>
  );
}

export interface ProviderCatalogueProps {
  groups: ModelProviderGroup[];
  modelCount: number;
  isLoading: boolean;
  hasError: boolean;
}

export function ProviderCatalogue({
  groups,
  modelCount,
  isLoading,
  hasError,
}: ProviderCatalogueProps) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const visibleGroups = useMemo(
    () =>
      selectedProvider ? groups.filter((group) => group.provider === selectedProvider) : groups,
    [groups, selectedProvider],
  );
  const description =
    modelCount > 0
      ? `All ${modelCount} models Polychat can reach, grouped by who serves them. Filter to a provider, or open one to search its full list.`
      : "Every model Polychat can reach, grouped by who serves them. Filter to a provider, or open one to search its full list.";

  return (
    <ModelsSection section={MODELS_SECTIONS.catalogue} description={description}>
      {groups.length > 0 && (
        <ProviderFilter
          groups={groups}
          selected={selectedProvider}
          onSelect={setSelectedProvider}
        />
      )}
      {isLoading ? (
        <CatalogueSkeleton />
      ) : hasError ? (
        <EmptyState
          title="The catalogue is out of reach"
          message="The model list could not be loaded. Try again in a moment."
          className="min-h-[200px]"
        />
      ) : (
        <div className="space-y-12">
          {visibleGroups.map((group) => (
            <ProviderGroup key={group.provider} group={group} />
          ))}
        </div>
      )}
    </ModelsSection>
  );
}
