import {
  ComposerActionMenu,
  ComposerAttachmentChips,
} from "@ngriffin_uk/polychat-component-conversation";
import { sitesService } from "@ngriffin_uk/polychat-library-client";
import { SITES_QUERY_KEYS, useSources } from "@ngriffin_uk/polychat-library-react";
import type { SiteRecord, SourceSummary } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, RefreshCw } from "lucide-react";
import { useState } from "react";

export function useSiteComposerSources({
  site,
  projectId,
  disabled,
  onSaved,
}: {
  site: SiteRecord | null;
  projectId?: string;
  disabled: boolean;
  onSaved: (site: SiteRecord) => void;
}) {
  const sources = useSources({ projectId });
  const queryClient = useQueryClient();
  const [selectedSources, setSelectedSources] = useState<SourceSummary[]>([]);
  const [previousProjectId, setPreviousProjectId] = useState(projectId);

  const connectedBindings = Object.entries(site?.project.dataBindings ?? {}).flatMap(
    ([id, binding]) => (binding.kind === "source" ? [{ id, binding }] : []),
  );
  const connectedIds = new Set(connectedBindings.map(({ binding }) => binding.sourceId));
  const pendingSources = selectedSources.filter((source) => !connectedIds.has(source.id));

  if (previousProjectId !== projectId) {
    setPreviousProjectId(projectId);
    setSelectedSources([]);
  } else if (pendingSources.length !== selectedSources.length) {
    setSelectedSources(pendingSources);
  }

  const attachedIds = new Set([...connectedIds, ...pendingSources.map((source) => source.id)]);
  const availableSources = (sources.data ?? []).filter(
    (source) =>
      attachedIds.size < 40 &&
      source.status === "available" &&
      source.projectId === (projectId ?? null) &&
      (source.kind === "text" || source.kind === "connector") &&
      !attachedIds.has(source.id),
  );
  const handleSaved = (saved: SiteRecord) => {
    onSaved(saved);
    queryClient.setQueryData(SITES_QUERY_KEYS.detail(projectId, saved.id), saved);
    void queryClient.invalidateQueries({ queryKey: SITES_QUERY_KEYS.list(projectId) });
  };

  const detach = useMutation({
    mutationFn: (sourceId: string) => {
      if (!site) {
        throw new Error("Build the site before disconnecting a saved source");
      }

      return sitesService.edit(site.id, {
        projectId,
        expectedRevision: site.revision,
        summary: "Disconnected a source",
        patches: [
          {
            op: "add",
            path: "/dataBindings",
            value: Object.fromEntries(
              Object.entries(site.project.dataBindings ?? {}).filter(
                ([, binding]) => binding.kind !== "source" || binding.sourceId !== sourceId,
              ),
            ),
          },
        ],
      });
    },
    onSuccess: (saved, sourceId) => {
      setSelectedSources((current) => current.filter((source) => source.id !== sourceId));
      handleSaved(saved);
    },
  });
  const refresh = useMutation({
    mutationFn: (bindingId: string) => {
      if (!site) {
        throw new Error("Build the site before refreshing a saved source");
      }

      return sitesService.refreshDataSource(site.id, {
        projectId,
        expectedRevision: site.revision,
        bindingId,
      });
    },
    onSuccess: handleSaved,
  });
  const isPending = detach.isPending || refresh.isPending;
  const isDisabled = disabled || isPending;
  const connectedSources = [...connectedIds].map((id) => ({
    id,
    source: sources.data?.find((source) => source.id === id),
    bindingId: connectedBindings.find(({ binding }) => binding.sourceId === id)?.id,
  }));
  const attachments = [
    ...connectedSources.map(({ id, source, bindingId }) => ({
      id,
      label: source?.title ?? bindingId ?? "Connected source",
      onClear: isDisabled ? undefined : () => detach.mutate(id),
      preview:
        source?.kind === "connector" && source.metadata.siteConnector && bindingId ? (
          <button
            type="button"
            disabled={isDisabled}
            aria-label={`Refresh ${source.title}`}
            title={`Refresh ${source.title} from connector`}
            onClick={() => refresh.mutate(bindingId)}
            className="rounded-sm disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : (
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        ),
    })),
    ...pendingSources.map((source) => ({
      id: source.id,
      label: source.title,
      onClear: isDisabled
        ? undefined
        : () => setSelectedSources((current) => current.filter((item) => item.id !== source.id)),
      preview: <FileText className="h-3.5 w-3.5" aria-hidden="true" />,
    })),
  ];

  return {
    sourceIds: pendingSources.map((source) => source.id),
    isPending,
    error: sources.error?.message ?? detach.error?.message ?? refresh.error?.message,
    attachments: attachments.length ? (
      <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
        <ComposerAttachmentChips attachments={attachments} />
      </div>
    ) : undefined,
    controls: (
      <ComposerActionMenu
        canAttachSources
        isDisabled={isDisabled}
        isLoadingSources={sources.isLoading}
        sourceScopeLabel={projectId ? "Project sources" : "Personal sources"}
        sources={availableSources}
        onAttachSource={(id) => {
          const source = availableSources.find((candidate) => candidate.id === id);

          if (isDisabled || !source) {
            return false;
          }

          setSelectedSources((current) =>
            current.some((item) => item.id === id) ? current : [...current, source],
          );

          return true;
        }}
      />
    ),
  };
}
