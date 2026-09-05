import { ModelIcon, ProviderGlyph } from "@ngriffin_uk/polychat-component-models";
import { Badge, EmptyState, Skeleton } from "@ngriffin_uk/polychat-component-ui";
import { getModelDisplayName, type ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { formatCompactCount } from "@ngriffin_uk/polychat-utility-core";
import { useMemo } from "react";

import { useModels } from "~/hooks/useModels";
import {
  groupModelsByProvider,
  isCatalogueModel,
  type ModelProviderGroup,
} from "~/lib/model-catalogue";

function ModelCard({ model }: { model: ModelConfigItem }) {
  const name = getModelDisplayName(model);
  const inputs = model.modalities?.input ?? [];
  const contextWindow = model.contextWindow ?? model.context_length;

  return (
    <li className="bg-surface border-border flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center">
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

function ProviderSection({ group }: { group: ModelProviderGroup }) {
  const headingId = `models-${group.provider}-title`;

  return (
    <section id={group.provider} aria-labelledby={headingId} className="scroll-mt-20 space-y-4">
      <div className="flex items-center gap-3">
        <span className="bg-surface border-border text-foreground flex h-9 w-9 items-center justify-center rounded-lg border">
          <ProviderGlyph name={group.provider} size={18} />
        </span>
        <h2
          id={headingId}
          className="font-display text-foreground text-2xl font-medium tracking-tight"
        >
          {group.label}
        </h2>
        <span className="polychat-eyebrow">
          {group.models.length} {group.models.length === 1 ? "model" : "models"}
        </span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.models.map((model) => (
          <ModelCard key={model.matchingModel} model={model} />
        ))}
      </ul>
    </section>
  );
}

export function ModelsCatalogue() {
  const { data, isLoading, error } = useModels();
  const models = useMemo(() => Object.values(data ?? {}).filter(isCatalogueModel), [data]);
  const groups = useMemo(() => groupModelsByProvider(models), [models]);
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
          <nav aria-label="Providers" className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <a
                key={group.provider}
                href={`#${group.provider}`}
                className="bg-surface border-border text-muted-foreground hover:border-border-strong hover:text-foreground flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium no-underline transition-colors"
              >
                <ProviderGlyph name={group.provider} size={12} />
                {group.label}
              </a>
            ))}
          </nav>
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
        groups.map((group) => <ProviderSection key={group.provider} group={group} />)
      )}
    </div>
  );
}
