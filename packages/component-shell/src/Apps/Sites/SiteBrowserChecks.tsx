import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { useVerifySite } from "@ngriffin_uk/polychat-library-react";
import type { SiteRecord } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useRef } from "react";

export function SiteBrowserChecks({
  site,
  pageId,
  verification,
}: {
  site: SiteRecord;
  pageId?: string;
  verification: ReturnType<typeof useVerifySite>;
}) {
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), [site.id, site.revision, pageId]);
  const verify = (repair: boolean) => {
    controller.current?.abort();
    const next = new AbortController();

    controller.current = next;
    verification.mutate(
      { pageId, repair, signal: next.signal },
      {
        onSettled: () => {
          if (controller.current === next) {
            controller.current = null;
          }
        },
      },
    );
  };

  const latestEvidence = verification.data;
  const evidence =
    latestEvidence?.siteId === site.id &&
    latestEvidence.revision === site.revision &&
    (!pageId || latestEvidence.checks.every((check) => check.pageId === pageId))
      ? latestEvidence
      : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <Button
        size="sm"
        variant="outline"
        disabled={verification.isPending}
        isLoading={verification.isPending}
        onClick={() => verify(false)}
      >
        Check browsers
      </Button>
      {evidence?.status === "failed" && (
        <Button size="sm" disabled={verification.isPending} onClick={() => verify(true)}>
          Repair and recheck
        </Button>
      )}
      {verification.isPending && (
        <Button size="sm" variant="ghost" onClick={() => controller.current?.abort()}>
          Cancel
        </Button>
      )}
      {evidence && (
        <details>
          <summary className="cursor-pointer text-muted-foreground">
            {evidence.status === "passed"
              ? "Desktop and mobile passed"
              : evidence.status === "failed"
                ? "Browser problems found"
                : "Browser checks unavailable"}
          </summary>
          <div className="mt-2 max-w-xl space-y-2 rounded-md border border-border bg-surface p-2">
            {evidence.checks.map((check) => (
              <div key={`${check.pageId}-${check.viewport}`}>
                <p className="font-medium capitalize">{check.viewport}</p>
                <p className="whitespace-pre-line text-muted-foreground">
                  {check.diagnostics.length > 0
                    ? check.diagnostics.map((item) => item.message).join("\n")
                    : check.status === "passed"
                      ? "Passed"
                      : "No diagnostics were returned"}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
      {verification.error && verification.error.name !== "AbortError" && (
        <output role="alert" className="text-failure">
          {verification.error.message}
        </output>
      )}
    </div>
  );
}
