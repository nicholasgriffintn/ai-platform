import { ModelIcon, ProviderGlyph } from "@ngriffin_uk/polychat-component-models";
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
import { getModelDisplayName, type ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { formatCompactCount } from "@ngriffin_uk/polychat-utility-core";
import { useDeferredValue, useMemo, useState } from "react";

import { useModelCatalogue } from "~/hooks/useModels";
import {
  filterModelsByQuery,
  groupModelsByProvider,
  isCatalogueModel,
  type ModelProviderGroup,
} from "~/lib/model-catalogue";

const PROVIDER_PREVIEW_LIMIT = 9;

function ProviderMark({ provider, size }: { provider: string; size: number }) {
  return (
    <ProviderGlyph
      name={provider}
      size={size}
      fallback={
        <span
          aria-hidden
          className="text-muted-foreground font-mono text-xs font-semibold uppercase"
          style={{ fontSize: size * 0.7 }}
        >
          {provider.charAt(0)}
        </span>
      }
    />
  );
}

function ModelCard({ model }: { model: ModelConfigItem }) {
  const name = getModelDisplayName(model);
  const inputs = model.modalities?.input ?? [];
  const contextWindow = model.contextWindow ?? model.context_length;

  return (
    <li className="bg-surface border-border flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <span className="text-foreground flex h-6 w-6 shrink-0 items-center justify-center">
          <ModelIcon url={model.avatarUrl} modelName={name} provider={model.provider} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-foreground text-sm font-medium break-words">{name}</span>
            {model.isFeatured && <Badge variant="info">Featured</Badge>}
            {model.isFree && <Badge variant="success">Free</Badge>}
            {model.status === "beta" && <Badge variant="warning">Beta</Badge>}
            {model.status === "alpha" && <Badge variant="warning">Alpha</Badge>}
            {model.openWeights && <Badge variant="outline">Open weights</Badge>}
          </div>
          {model.description && (
            <p className="text-muted-foreground mt-1 line-clamp-3 text-xs leading-relaxed">
              {model.description}
            </p>
          )}
        </div>
      </div>
      {(inputs.length > 0 || contextWindow) && (
        <dl className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
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
          <DialogTitle className="font-display flex items-center gap-2 text-2xl font-medium tracking-tight">
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

function ProviderSection({ group }: { group: ModelProviderGroup }) {
  const headingId = `models-${group.provider}-title`;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const hasOverflow = group.models.length > PROVIDER_PREVIEW_LIMIT;
  const preview = hasOverflow ? group.models.slice(0, PROVIDER_PREVIEW_LIMIT) : group.models;

  return (
    <section id={group.provider} aria-labelledby={headingId} className="scroll-mt-20 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-surface border-border text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
            <ProviderMark provider={group.provider} size={18} />
          </span>
          <h2
            id={headingId}
            className="font-display text-foreground truncate text-2xl font-medium tracking-tight"
          >
            {group.label}
          </h2>
        </div>
        <span className="polychat-eyebrow shrink-0 text-right">
          {group.models.length} {group.models.length === 1 ? "model" : "models"}
        </span>
      </div>
      <ModelGrid models={preview} label={`${group.label} models`} />
      {hasOverflow && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground text-xs">
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
        : "bg-surface border-border text-foreground hover:border-border-strong",
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
            <span className="text-muted-foreground font-mono">{group.models.length}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ModelsCatalogue() {
  const { data, isLoading, error } = useModelCatalogue();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const models = useMemo(() => Object.values(data ?? {}).filter(isCatalogueModel), [data]);
  const groups = useMemo(() => groupModelsByProvider(models), [models]);
  const visibleGroups = useMemo(
    () =>
      selectedProvider ? groups.filter((group) => group.provider === selectedProvider) : groups,
    [groups, selectedProvider],
  );
  const lede =
    models.length > 0
      ? `${models.length} models from ${groups.length} providers. Pick one per message, or leave it to Auto and let Polychat route by task.`
      : "Every model Polychat can reach, grouped by provider. Pick one per message, or leave it to Auto and let Polychat route by task.";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-12 px-4 pb-16 sm:px-6">
      <header className="space-y-4 pt-2">
        <p className="polychat-eyebrow">The catalogue</p>
        <h1 className="font-display text-foreground text-4xl font-medium tracking-tight text-balance md:text-5xl">
          Every model, one perch
        </h1>
        <p className="text-muted-foreground max-w-prose text-lg leading-relaxed">{lede}</p>
        {groups.length > 0 && (
          <ProviderFilter
            groups={groups}
            selected={selectedProvider}
            onSelect={setSelectedProvider}
          />
        )}
      </header>
      {isLoading ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading models">
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index}>
              <Skeleton className="h-28 w-full rounded-xl" />
            </li>
          ))}
        </ul>
      ) : error ? (
        <EmptyState
          title="The catalogue is out of reach"
          message="The model list could not be loaded. Try again in a moment."
          className="min-h-[200px]"
        />
      ) : (
        visibleGroups.map((group) => <ProviderSection key={group.provider} group={group} />)
      )}
    </div>
  );
}
