import { Button } from "@ngriffin_uk/polychat-component-ui";
import { sitesService } from "@ngriffin_uk/polychat-library-client";
import { useSources } from "@ngriffin_uk/polychat-library-react";
import {
  listSitePages,
  siteDataIdentifierSchema,
  type SiteRecord,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

export function SiteDataSources({
  site,
  onSaved,
}: {
  site: SiteRecord;
  onSaved: (site: SiteRecord) => void;
}) {
  const sources = useSources({ projectId: site.projectId ?? undefined });
  const pages = listSitePages(site.project);
  const [sourceId, setSourceId] = useState("");
  const [pageId, setPageId] = useState(pages[0]?.id ?? "");
  const [name, setName] = useState("records");
  const attach = useMutation({
    mutationFn: () =>
      sitesService.edit(site.id, {
        projectId: site.projectId ?? undefined,
        expectedRevision: site.revision,
        summary: `Connected ${name} to a data source`,
        patches: [
          {
            op: "add",
            path: "/dataBindings",
            value: {
              ...site.project.dataBindings,
              [name]: { kind: "source", sourceId, pageId, statePath: `/${name}` },
            },
          },
        ],
      }),
    onSuccess: onSaved,
  });

  const refresh = useMutation({
    mutationFn: (bindingId: string) =>
      sitesService.refreshDataSource(site.id, {
        projectId: site.projectId ?? undefined,
        expectedRevision: site.revision,
        bindingId,
      }),
    onSuccess: onSaved,
  });

  return (
    <details className="rounded-md border border-border p-3 text-xs">
      <summary className="cursor-pointer font-medium">Data sources</summary>
      <div className="mt-3 flex flex-col gap-2">
        <p className="text-muted-foreground">
          Connect a source containing a JSON list of records. Source data stays private to this
          app's scope.
        </p>
        <label className="flex flex-col gap-1">
          Source
          <select
            aria-label="Data source"
            className="rounded border border-input bg-background p-2"
            value={sourceId}
            onChange={(event) => setSourceId(event.target.value)}
          >
            <option value="">Choose a source</option>
            {sources.data
              ?.filter(
                (source) =>
                  source.status === "available" &&
                  source.projectId === site.projectId &&
                  ["text", "connector"].includes(source.kind),
              )
              .map((source) => (
                <option key={source.id} value={source.id}>
                  {source.title}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Page
          <select
            aria-label="Data page"
            className="rounded border border-input bg-background p-2"
            value={pageId}
            onChange={(event) => setPageId(event.target.value)}
          >
            {pages.map(({ id, page }) => (
              <option key={id} value={id}>
                {page.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Data name
          <input
            aria-label="Data name"
            className="rounded border border-input bg-background p-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="records"
          />
        </label>
        <Button
          size="xs"
          variant="outline"
          disabled={!sourceId || !pageId || !siteDataIdentifierSchema.safeParse(name).success}
          isLoading={attach.isPending}
          onClick={() => attach.mutate()}
        >
          Connect source
        </Button>
        {Object.entries(site.project.dataBindings ?? {})
          .filter(
            ([, binding]) =>
              binding.kind === "source" &&
              sources.data?.some(
                (source) =>
                  source.id === binding.sourceId &&
                  source.kind === "connector" &&
                  Boolean(source.metadata.siteConnector),
              ),
          )
          .map(([id]) => (
            <Button
              key={id}
              size="xs"
              variant="ghost"
              disabled={refresh.isPending}
              onClick={() => refresh.mutate(id)}
            >
              Refresh {id} from connector
            </Button>
          ))}
        {(sources.error || attach.error || refresh.error) && (
          <output role="alert" className="text-failure">
            {sources.error?.message ?? attach.error?.message ?? refresh.error?.message}
          </output>
        )}
      </div>
    </details>
  );
}
