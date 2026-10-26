import {
  Badge,
  Button,
  FormSelect,
  Switch,
  textLinkClassName,
} from "@ngriffin_uk/polychat-component-ui";
import {
  useKnowledgeDocument,
  useKnowledgeDocumentActions,
} from "@ngriffin_uk/polychat-library-react";
import type { KnowledgeDocumentState, KnowledgeOrigin } from "@ngriffin_uk/polychat-schemas";
import {
  DAY_MS,
  formatDate,
  formatRelativeTime,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-core";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

const ORIGIN_LABELS: Record<KnowledgeOrigin, string> = {
  upload: "Uploaded",
  manual: "Added by hand",
  note: "A note",
  page: "A web page",
  feed: "A followed feed",
  topic: "A followed topic",
  connector: "Synced from a connected service",
  device: "Shared from your Mac",
  generated: "Made in Polychat",
  evidence: "Captured as task evidence",
  site: "Site data",
  research: "Research",
  repository: "Repository",
};

const RELATION_LABELS: Record<KnowledgeDocumentState["relations"][number]["relation"], string> = {
  cites: "Cites",
  duplicates: "Same text as",
  updates: "Updates",
  mentions: "Mentions",
  derived_from: "Made from",
};

const REMOVAL_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "7", label: "In a week" },
  { value: "30", label: "In a month" },
  { value: "90", label: "In three months" },
] as const;

const SENSITIVITY_OPTIONS = [
  { value: "none", label: "Not set" },
  { value: "personal", label: "Personal" },
  { value: "internal", label: "Internal" },
  { value: "confidential", label: "Confidential, never for teammates" },
] as const;

type RemovalChoice = (typeof REMOVAL_OPTIONS)[number]["value"] | "scheduled";
type SensitivityChoice = (typeof SENSITIVITY_OPTIONS)[number]["value"];

const STATUS_VARIANTS = {
  done: "success",
  failed: "destructive",
  skipped: "outline",
  pending: "secondary",
} as const;

function describeStorage(state: KnowledgeDocumentState): string {
  const characters = state.characters.toLocaleString();

  return state.stored === "body"
    ? `${characters} characters, kept in file storage`
    : `${characters} characters`;
}

function describeIndex(indexed: KnowledgeDocumentState["indexed"]): string {
  if (indexed === "active") {
    return "Searchable by meaning and keyword";
  }

  return indexed === "lexical" ? "Searchable by keyword, meaning on its way" : "Not searchable yet";
}

function removalDate(choice: Exclude<RemovalChoice, "scheduled">): string | null {
  return choice === "never" ? null : new Date(Date.now() + Number(choice) * DAY_MS).toISOString();
}

function removalOptions(expiresAt: string | null) {
  return expiresAt
    ? [
        {
          value: "scheduled" as const,
          label: `On ${formatDate(expiresAt)}`,
        },
        ...REMOVAL_OPTIONS,
      ]
    : REMOVAL_OPTIONS;
}

export function SourceKnowledgePanel({
  sourceId,
  onOpenSource,
  onOpenCollection,
}: {
  sourceId: string;
  onOpenSource: (id: string) => void;
  onOpenCollection: (id: string) => void;
}) {
  const { data: state, isLoading, error } = useKnowledgeDocument(sourceId);
  const actions = useKnowledgeDocumentActions(sourceId);

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Reading what Poly knows about this file…</p>
    );
  }

  if (error || !state) {
    return (
      <p className="text-sm text-muted-foreground">
        {error
          ? getErrorMessage(error, "This file could not be read.")
          : "Nothing filed for this one."}
      </p>
    );
  }

  const change = (controls: Parameters<typeof actions.controls.mutate>[0]) =>
    actions.controls.mutate(controls, {
      onError: (failure) => toast.error(getErrorMessage(failure, "That change did not stick.")),
    });
  const topics = state.collections.filter((collection) => collection.kind === "topic");
  const entities = state.collections.filter((collection) => collection.kind === "entity");
  const folders = state.collections.filter(
    (collection) => collection.kind !== "topic" && collection.kind !== "entity",
  );

  return (
    <div className="flex flex-col gap-5 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        <dt className="text-muted-foreground">From</dt>
        <dd className="text-foreground">
          {state.origin ? ORIGIN_LABELS[state.origin] : "Not recorded"}
          {state.upstream?.url ? (
            <>
              {" · "}
              <a
                href={state.upstream.url}
                target="_blank"
                rel="noopener noreferrer"
                className={textLinkClassName({})}
              >
                open in {state.upstream.provider}
              </a>
            </>
          ) : null}
        </dd>
        {state.upstream?.syncedAt ? (
          <>
            <dt className="text-muted-foreground">Synced</dt>
            <dd className="text-foreground">{formatRelativeTime(state.upstream.syncedAt)}</dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">Kept</dt>
        <dd className="text-foreground">{describeStorage(state)}</dd>
        <dt className="text-muted-foreground">Search</dt>
        <dd className="text-foreground">{describeIndex(state.indexed)}</dd>
      </dl>

      {state.enrichments.length > 0 ? (
        <section aria-label="Enrichment" className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Read through
            </h3>
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={14} />}
              isLoading={actions.reprocess.isPending}
              onClick={() =>
                actions.reprocess.mutate(undefined, {
                  onSuccess: () => toast.success("Back in the queue. Give it a minute."),
                })
              }
            >
              Read again
            </Button>
          </div>
          <ul className="flex flex-col gap-1.5">
            {state.enrichments.map((enrichment) => (
              <li key={enrichment.name} className="flex items-start justify-between gap-3">
                <span className="text-foreground">{enrichment.label}</span>
                <span className="flex flex-col items-end gap-0.5 text-right">
                  <Badge variant={STATUS_VARIANTS[enrichment.status]}>
                    {enrichment.status === "done"
                      ? "Done"
                      : enrichment.status === "failed"
                        ? "Failed"
                        : enrichment.status === "skipped"
                          ? "Skipped"
                          : "Waiting"}
                  </Badge>
                  {enrichment.error ? (
                    <span className="text-xs text-failure">{enrichment.error}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {[
        { label: "Topics", items: topics },
        { label: "About", items: entities },
        { label: "Folders and notebooks", items: folders },
      ].map(({ label, items }) =>
        items.length > 0 ? (
          <section key={label} aria-label={label} className="flex flex-col gap-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {label}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {items.map((collection) => (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => onOpenCollection(collection.id)}
                  className="rounded-md border border-border px-2 py-0.5 text-xs text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {collection.title}
                </button>
              ))}
            </div>
          </section>
        ) : null,
      )}

      {state.relations.length > 0 ? (
        <section aria-label="Related documents" className="flex flex-col gap-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Related
          </h3>
          <ul className="flex flex-col gap-1">
            {state.relations.map((relation) => {
              const otherId =
                relation.sourceId === sourceId ? relation.relatedSourceId : relation.sourceId;

              return (
                <li key={`${relation.relation}:${otherId}`}>
                  <span className="text-muted-foreground">
                    {relation.sourceId === sourceId
                      ? RELATION_LABELS[relation.relation]
                      : "Linked from"}
                  </span>{" "}
                  <button
                    type="button"
                    className={textLinkClassName({})}
                    onClick={() => onOpenSource(otherId)}
                  >
                    {relation.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-label="Controls" className="flex flex-col gap-3 border-t border-border pt-4">
        <Switch
          label="Use in answers"
          description="Turn off to keep this file without Poly or teammates quoting it."
          checked={state.retrieval === "included"}
          disabled={actions.controls.isPending}
          onChange={(event) =>
            change({ retrieval: event.target.checked ? "included" : "excluded" })
          }
        />
        <FormSelect<RemovalChoice>
          label="Remove automatically"
          description="Useful for pages you only need for a while. It goes from Files and from answers."
          options={removalOptions(state.expiresAt)}
          value={state.expiresAt ? "scheduled" : "never"}
          onValueChange={(choice) => {
            if (choice !== "scheduled") {
              change({ expiresAt: removalDate(choice) });
            }
          }}
          disabled={actions.controls.isPending}
          fullWidth
        />
        <FormSelect<SensitivityChoice>
          label="Sensitivity"
          options={SENSITIVITY_OPTIONS}
          value={state.sensitivity ?? "none"}
          onValueChange={(choice) => change({ sensitivity: choice === "none" ? null : choice })}
          disabled={actions.controls.isPending}
          fullWidth
        />
      </section>
    </div>
  );
}
