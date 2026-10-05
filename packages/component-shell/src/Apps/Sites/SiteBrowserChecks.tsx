import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { useVerifySite } from "@ngriffin_uk/polychat-library-react";
import type { SiteRecord } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useRef } from "react";

export function SiteBrowserChecks({
  site,
  pageId,
  verification,
  disabled,
}: {
  site: SiteRecord;
  pageId?: string;
  verification: ReturnType<typeof useVerifySite>;
  disabled: boolean;
}) {
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), [site.id, site.revision, pageId]);
  const verify = (repair: boolean) => {
    controller.current?.abort();
    const next = new AbortController();

    controller.current = next;
    verification.mutate({ pageId, repair, signal: next.signal });
  };

  const latestEvidence = verification.data;
  const evidence =
    latestEvidence?.siteId === site.id &&
    latestEvidence.revision === site.revision &&
    (!pageId || latestEvidence.checks.every((check) => check.pageId === pageId))
      ? latestEvidence
      : null;

  return (
    <details className="rounded-md border border-border p-3 text-xs">
      <summary className="cursor-pointer font-medium">Browser checks</summary>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            size="xs"
            variant="outline"
            disabled={disabled || verification.isPending}
            onClick={() => verify(false)}
          >
            Check in browser
          </Button>
          {evidence?.status === "failed" && (
            <Button
              size="xs"
              disabled={disabled || verification.isPending}
              onClick={() => verify(true)}
            >
              Try one repair
            </Button>
          )}
          {verification.isPending && (
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
        {verification.error && (
          <output role="alert" className="text-failure">
            {verification.error.message}
          </output>
        )}
      </div>
    </details>
  );
}
