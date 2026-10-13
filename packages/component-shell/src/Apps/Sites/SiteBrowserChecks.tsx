import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@ngriffin_uk/polychat-component-ui";
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
  const diagnosticCount =
    evidence?.checks.reduce((total, check) => total + check.diagnostics.length, 0) ?? 0;

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Button
        size="sm"
        variant="outline"
        disabled={verification.isPending}
        isLoading={verification.isPending}
        onClick={() => verify(false)}
      >
        Check browsers
      </Button>
      {verification.isPending && (
        <Button size="sm" variant="ghost" onClick={() => controller.current?.abort()}>
          Cancel
        </Button>
      )}
      {evidence && (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost">
              {evidence.status === "passed"
                ? "Browsers passed"
                : evidence.status === "failed"
                  ? `${diagnosticCount} browser ${diagnosticCount === 1 ? "issue" : "issues"}`
                  : "Checks unavailable"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-96 max-w-[calc(100vw-1rem)] space-y-3">
            <div>
              <p className="font-medium">Browser checks</p>
              <p className="text-xs text-muted-foreground">Saved revision {evidence.revision}</p>
            </div>
            <div className="space-y-2 text-xs">
              {evidence.checks.map((check) => (
                <div
                  key={`${check.pageId}-${check.viewport}`}
                  className="rounded-md bg-surface p-2"
                >
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
            {evidence.status === "failed" && (
              <Button
                size="sm"
                disabled={verification.isPending}
                isLoading={verification.isPending}
                onClick={() => verify(true)}
              >
                Repair and recheck
              </Button>
            )}
          </PopoverContent>
        </Popover>
      )}
      {verification.error && verification.error.name !== "AbortError" && (
        <output
          role="alert"
          className="max-w-64 truncate text-failure"
          title={verification.error.message}
        >
          {verification.error.message}
        </output>
      )}
    </div>
  );
}
