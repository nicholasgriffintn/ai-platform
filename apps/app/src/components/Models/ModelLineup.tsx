import { getModelTierIcon, ModelIcon, ProviderGlyph } from "@ngriffin_uk/polychat-component-models";
import { Badge, cn, Skeleton } from "@ngriffin_uk/polychat-component-ui";
import {
  formatReasoningLabel,
  MODEL_LINEUP_RUNTIME_DEFINITIONS,
  MODEL_TIER_DEFINITIONS,
  MODEL_TIER_LINEUP,
  MODEL_TIER_ROLE_DEFINITIONS,
  MODEL_TIER_ROLES,
  SYSTEM_MODEL_LINEUP,
  type ModelLineupCandidate,
  type ModelLineupRuntime,
  type ModelTier,
  type ModelTierRole,
} from "@ngriffin_uk/polychat-schemas";
import { useMemo } from "react";

import { useModelCatalogue, useModels } from "~/hooks/useModels";
import { formatProviderLabel } from "~/lib/model-catalogue";
import {
  resolveLineupHeadline,
  toModelRecordById,
  type LineupEntryView,
} from "~/lib/model-lineup-view";
import { useChatStore } from "~/state/stores/chatStore";

const TIER_ACCENT: Record<ModelTier, string> = {
  low: "text-success bg-success/10 border-success/25",
  medium: "text-active-work bg-active-work/10 border-active-work/25",
  high: "text-attention bg-attention/10 border-attention/25",
  ultra: "text-failure bg-failure/10 border-failure/25",
};

const AUTOMATION_ROWS = [
  {
    label: "Recipes and channels",
    description: "Scheduled recipes and inbound messages reply with the project or account tier.",
    uses: "Agent role of the default tier",
  },
  {
    label: "Sandbox coding",
    description: "Work coding runs use the coding role of the project's tier.",
    uses: "Coding role of the project tier",
  },
  {
    label: "Panels and memory",
    description: "Multi-member panels, memory synthesis, notes and search summaries.",
    uses: "Housekeeping",
  },
  {
    label: "Deep research",
    description: "Long-running research is delegated to Parallel or Exa rather than a chat model.",
    uses: "Research providers",
  },
] as const;

function useLineupModels() {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const catalogue = useModelCatalogue();
  const account = useModels();
  const catalogueRecord = useMemo(
    () => toModelRecordById(Object.values(catalogue.data ?? {})),
    [catalogue.data],
  );
  const accountRecord = useMemo(
    () => (isAuthenticated ? toModelRecordById(Object.values(account.data ?? {})) : null),
    [account.data, isAuthenticated],
  );

  return { catalogueRecord, accountRecord, isLoading: catalogue.isLoading };
}

function EntryMark({ entry, size = 16 }: { entry: LineupEntryView; size?: number }) {
  return entry.model ? (
    <ModelIcon
      url={entry.model.avatarUrl}
      modelName={entry.name}
      provider={entry.provider}
      size={size}
    />
  ) : (
    <ProviderGlyph
      name={entry.provider}
      size={size}
      fallback={
        <span aria-hidden className="text-muted-foreground font-mono text-[10px] uppercase">
          {entry.provider.charAt(0)}
        </span>
      }
    />
  );
}

function EntryLine({
  entry,
  yours,
  compact = false,
}: {
  entry: LineupEntryView | null;
  yours?: LineupEntryView | null;
  compact?: boolean;
}) {
  if (!entry) {
    return <span className="text-muted-foreground text-xs">Nothing configured</span>;
  }

  const showYours = yours !== undefined && yours?.id !== entry.id;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-foreground flex min-w-0 items-center gap-2 text-sm font-medium">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          <EntryMark entry={entry} />
        </span>
        <span className="truncate">{entry.name}</span>
        {entry.effort && !compact && (
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            {formatReasoningLabel(entry.effort)}
          </Badge>
        )}
      </span>
      <span className="text-muted-foreground pl-7 font-mono text-[11px]">
        {formatProviderLabel(entry.provider)}
        {compact && entry.effort ? ` · ${formatReasoningLabel(entry.effort)}` : ""}
      </span>
      {showYours && (
        <span className="text-muted-foreground pl-7 text-[11px]">
          {yours ? (
            <>
              On your plan: <span className="text-foreground">{yours.name}</span> via{" "}
              {formatProviderLabel(yours.provider)}
            </>
          ) : (
            "Not available on your plan yet"
          )}
        </span>
      )}
    </div>
  );
}

function useTierEntries(runtime: ModelLineupRuntime) {
  const { catalogueRecord, accountRecord } = useLineupModels();

  return useMemo(() => {
    const entries = new Map<
      string,
      { headline: LineupEntryView | null; yours: LineupEntryView | null | undefined }
    >();

    for (const tier of MODEL_TIER_DEFINITIONS) {
      for (const role of MODEL_TIER_ROLES) {
        const candidates: readonly ModelLineupCandidate[] =
          MODEL_TIER_LINEUP[runtime][tier.id][role];

        entries.set(`${tier.id}:${role}`, {
          headline: resolveLineupHeadline(catalogueRecord, candidates),
          yours:
            accountRecord && runtime === "hosted"
              ? resolveLineupHeadline(
                  accountRecord,
                  candidates,
                  (model) => model.isExecutable === true,
                )
              : undefined,
        });
      }
    }

    return entries;
  }, [accountRecord, catalogueRecord, runtime]);
}

function TierCard({ tier }: { tier: (typeof MODEL_TIER_DEFINITIONS)[number] }) {
  const entries = useTierEntries("hosted");
  const Icon = getModelTierIcon(tier.id);

  return (
    <li className="bg-surface border-border flex flex-col gap-4 rounded-2xl border p-5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
            TIER_ACCENT[tier.id],
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-foreground text-xl font-medium tracking-tight">
            {tier.label}
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">{tier.description}</p>
        </div>
      </div>
      <dl className="divide-border grid divide-y">
        {MODEL_TIER_ROLES.map((role: ModelTierRole) => {
          const entry = entries.get(`${tier.id}:${role}`);

          return (
            <div key={role} className="grid gap-1 py-3 first:pt-0 last:pb-0">
              <dt className="polychat-eyebrow">{MODEL_TIER_ROLE_DEFINITIONS[role].label}</dt>
              <dd>
                <EntryLine entry={entry?.headline ?? null} yours={entry?.yours} />
              </dd>
            </div>
          );
        })}
      </dl>
    </li>
  );
}

function LocalRuntimeTable({ runtime }: { runtime: "browser" | "local-server" }) {
  const entries = useTierEntries(runtime);
  const definition = MODEL_LINEUP_RUNTIME_DEFINITIONS[runtime];

  return (
    <section
      aria-labelledby={`lineup-${runtime}-title`}
      className="bg-surface border-border rounded-2xl border p-5"
    >
      <h3
        id={`lineup-${runtime}-title`}
        className="font-display text-foreground text-xl font-medium tracking-tight"
      >
        {definition.label}
      </h3>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{definition.description}</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="polychat-eyebrow">
              <th scope="col" className="pb-2 pr-4 font-medium">
                Tier
              </th>
              {MODEL_TIER_ROLES.map((role) => (
                <th key={role} scope="col" className="pb-2 pr-4 font-medium">
                  {MODEL_TIER_ROLE_DEFINITIONS[role].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {MODEL_TIER_DEFINITIONS.map((tier) => (
              <tr key={tier.id}>
                <th scope="row" className="text-foreground py-3 pr-4 align-top font-medium">
                  {tier.label}
                </th>
                {MODEL_TIER_ROLES.map((role) => (
                  <td key={role} className="py-3 pr-4 align-top">
                    <EntryLine
                      entry={entries.get(`${tier.id}:${role}`)?.headline ?? null}
                      compact
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SystemModels() {
  const { catalogueRecord, accountRecord } = useLineupModels();
  const rows = useMemo(
    () =>
      SYSTEM_MODEL_LINEUP.map((role) => ({
        role,
        headline: resolveLineupHeadline(catalogueRecord, role.candidates),
        yours: accountRecord
          ? resolveLineupHeadline(
              accountRecord,
              role.candidates,
              (model) => model.isExecutable === true,
            )
          : undefined,
      })),
    [accountRecord, catalogueRecord],
  );

  return (
    <ul aria-label="System models" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(({ role, headline, yours }) => (
        <li
          key={role.id}
          className="bg-surface border-border flex flex-col gap-3 rounded-xl border p-4"
        >
          <div>
            <h3 className="text-foreground text-sm font-semibold">{role.label}</h3>
            <p className="text-muted-foreground text-xs leading-relaxed">{role.description}</p>
          </div>
          <EntryLine entry={headline} yours={yours} compact />
        </li>
      ))}
    </ul>
  );
}

function LineupSkeleton() {
  return (
    <ul className="grid gap-4 md:grid-cols-2" aria-label="Loading the lineup">
      {MODEL_TIER_DEFINITIONS.map((tier) => (
        <li key={tier.id}>
          <Skeleton className="h-52 w-full rounded-2xl" />
        </li>
      ))}
    </ul>
  );
}

export function ModelLineup() {
  const { isLoading } = useLineupModels();

  return (
    <div className="space-y-12">
      <header className="space-y-4 pt-2">
        <p className="polychat-eyebrow">Modes and models</p>
        <h1 className="font-display text-foreground text-4xl font-medium tracking-tight text-balance md:text-5xl">
          The right model for each job
        </h1>
        <p className="text-muted-foreground max-w-prose text-lg leading-relaxed">
          Polychat leans on the strongest generalist models where reasoning matters and on small,
          fast models where speed and cost do. Pick a tier per message and the first model your plan
          can reach wins, whether that is through Polychat or your own provider keys.
        </p>
      </header>

      <section aria-labelledby="lineup-tiers-title" className="space-y-5">
        <div className="space-y-1">
          <h2
            id="lineup-tiers-title"
            className="font-display text-foreground text-2xl font-medium tracking-tight"
          >
            Tiers
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
            {MODEL_LINEUP_RUNTIME_DEFINITIONS.hosted.description}
          </p>
        </div>
        {isLoading ? (
          <LineupSkeleton />
        ) : (
          <ul aria-label="Model tiers" className="grid gap-4 md:grid-cols-2">
            {MODEL_TIER_DEFINITIONS.map((tier) => (
              <TierCard key={tier.id} tier={tier} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="lineup-local-title" className="space-y-5">
        <div className="space-y-1">
          <h2
            id="lineup-local-title"
            className="font-display text-foreground text-2xl font-medium tracking-tight"
          >
            On your own hardware
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
            The same tiers apply when nothing leaves your machine. Sizes are chosen to fit typical
            laptops first and larger local servers second.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <LocalRuntimeTable runtime="browser" />
          <LocalRuntimeTable runtime="local-server" />
        </div>
      </section>

      <section aria-labelledby="lineup-system-title" className="space-y-5">
        <div className="space-y-1">
          <h2
            id="lineup-system-title"
            className="font-display text-foreground text-2xl font-medium tracking-tight"
          >
            System models
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
            Specialist jobs use fixed, inexpensive models rather than the conversation tier. Each
            list is a hierarchy too, so a Free plan still gets a working default.
          </p>
        </div>
        <SystemModels />
      </section>

      <section aria-labelledby="lineup-automations-title" className="space-y-5">
        <div className="space-y-1">
          <h2
            id="lineup-automations-title"
            className="font-display text-foreground text-2xl font-medium tracking-tight"
          >
            Behind the scenes
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
            Where the other parts of Polychat get their models from.
          </p>
        </div>
        <ul aria-label="Automations" className="grid gap-3 sm:grid-cols-2">
          {AUTOMATION_ROWS.map((row) => (
            <li
              key={row.label}
              className="bg-surface border-border flex items-start justify-between gap-4 rounded-xl border p-4"
            >
              <div className="min-w-0">
                <h3 className="text-foreground text-sm font-semibold">{row.label}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{row.description}</p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {row.uses}
              </Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
