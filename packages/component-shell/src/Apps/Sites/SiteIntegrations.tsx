import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { useSiteIntegrations } from "@ngriffin_uk/polychat-library-react";
import type { SiteRecord } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useRef } from "react";

import { SiteDataSources } from "./SiteDataSources.js";

export function SiteIntegrations({
  site,
  pageId,
  integrations,
  disabled,
  onSaved,
}: {
  site: SiteRecord;
  pageId?: string;
  integrations: ReturnType<typeof useSiteIntegrations>;
  disabled: boolean;
  onSaved: (site: SiteRecord) => void;
}) {
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), [site.id, site.revision, pageId]);

  const verify = (repair: boolean) => {
    controller.current?.abort();
    const next = new AbortController();

    controller.current = next;
    integrations.verify.mutate({ pageId, repair, signal: next.signal });
  };

  const latestEvidence = integrations.verify.data;
  const evidence =
    latestEvidence?.revision === site.revision &&
    (!pageId || latestEvidence.checks.every((check) => check.pageId === pageId))
      ? latestEvidence
      : null;
  const storage = integrations.data.data?.runtime;
  const hasCollections = Object.keys(site.project.collections ?? {}).length > 0;

  return (
    <details className="rounded-md border border-border p-3 text-xs">
      <summary className="cursor-pointer font-medium">Data and browser checks</summary>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            size="xs"
            variant="outline"
            disabled={disabled || integrations.verify.isPending}
            onClick={() => verify(false)}
          >
            Check in browser
          </Button>
          {evidence?.status === "failed" && (
            <Button
              size="xs"
              disabled={disabled || integrations.verify.isPending}
              onClick={() => verify(true)}
            >
              Try one repair
            </Button>
          )}
          {integrations.verify.isPending && (
            <Button size="xs" variant="ghost" onClick={() => controller.current?.abort()}>
              Cancel check
            </Button>
          )}
        </div>
        {evidence && (
          <div>
            <p>
              {evidence.status === "passed"
                ? "Desktop and mobile checks passed"
                : evidence.status === "failed"
                  ? "The browser found problems"
                  : "Browser checks are unavailable"}
            </p>
            {evidence.checks.flatMap((check) =>
              check.diagnostics.map((item, index) => (
                <p key={`${check.viewport}-${index}`} className="mt-1 text-muted-foreground">
                  {check.viewport}: {item.message}
                </p>
              )),
            )}
          </div>
        )}
        {hasCollections && (
          <div className="flex flex-col gap-2">
            <p>Save records between visits. Disabling storage preserves existing records.</p>
            <Button
              size="xs"
              variant="outline"
              disabled={disabled}
              isLoading={integrations.storage.isPending}
              onClick={() =>
                integrations.storage.mutate(
                  !(storage?.enabled && storage.revision === site.revision),
                )
              }
            >
              {storage?.enabled && storage.revision === site.revision
                ? "Disable saved records"
                : storage?.enabled
                  ? "Update saved records"
                  : "Enable saved records"}
            </Button>
          </div>
        )}
        {!disabled && <SiteDataSources site={site} onSaved={onSaved} />}
        {(integrations.data.error || integrations.storage.error || integrations.verify.error) && (
          <output role="alert" className="text-failure">
            {integrations.data.error?.message ??
              integrations.storage.error?.message ??
              integrations.verify.error?.message}
          </output>
        )}
      </div>
    </details>
  );
}
