import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ArticleReportItem } from "@ngriffin_uk/polychat-schemas";
import { ArrowDown, ExternalLink, Info } from "lucide-react";
import { useState } from "react";

interface ArticleReportMetadataProps {
  report: ArticleReportItem;
}

export function ArticleReportMetadata({ report }: ArticleReportMetadataProps) {
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <button
        type="button"
        onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
        className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-surface-elevated"
      >
        <h3 className="flex items-center text-lg font-medium text-foreground">
          <Info size={18} className="mr-2 text-active-work" />
          Report Metadata
        </h3>
        <div className="flex items-center">
          <span className="mr-2 text-sm text-muted-foreground">
            {isMetadataExpanded ? "Hide" : "Show"} details
          </span>
          <ArrowDown
            size={18}
            className={cn(
              "text-muted-foreground transition-transform duration-300",
              isMetadataExpanded ? "rotate-180" : "",
            )}
          />
        </div>
      </button>

      {isMetadataExpanded && (
        <div className="animate-in border-t border-border p-5 duration-300 slide-in-from-top-10">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface-elevated p-4">
              <h4 className="mb-3 flex items-center text-sm font-medium text-foreground">
                <Info size={14} className="mr-2 text-active-work" />
                Basic Information
              </h4>
              <div className="space-y-1 text-sm">
                <MetadataItem label="Report ID">{report.id}</MetadataItem>
                <MetadataItem label="Session ID">{report.groupId || "N/A"}</MetadataItem>
                <MetadataItem label="Created">
                  {new Date(report.createdAt).toLocaleString()}
                </MetadataItem>
                <MetadataItem label="Updated">
                  {report.updatedAt ? new Date(report.updatedAt).toLocaleString() : "N/A"}
                </MetadataItem>
                {report.content.report?.model && (
                  <MetadataItem label="Model">{report.content.report.model}</MetadataItem>
                )}
                {report.content.report?.log_id && (
                  <MetadataItem label="Log ID">{report.content.report.log_id}</MetadataItem>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface-elevated p-4">
              <h4 className="mb-3 flex items-center text-sm font-medium text-foreground">
                <ExternalLink size={14} className="mr-2 text-active-work" />
                Citation Information
              </h4>
              {report.content.report?.citations?.length ? (
                <div className="space-y-2">
                  <span className="mb-1 block text-sm font-medium text-foreground">Citations:</span>
                  <ul className="list-none space-y-1.5 pl-0 text-sm">
                    {report.content.report.citations.map((citation: string) => (
                      <li
                        key={`${report.id}-${citation}`}
                        className="rounded border border-border bg-surface p-2 break-all"
                      >
                        <a
                          href={citation}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center text-active-work transition-colors hover:text-active-work"
                        >
                          <span className="truncate group-hover:underline">{citation}</span>
                          <ExternalLink size={10} className="ml-1 flex-shrink-0" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No citations available</p>
              )}

              {report.content.report?.verifiedQuotes && (
                <div className="mt-4">
                  <span className="mb-2 block text-sm font-medium text-foreground">
                    Quotes Verification:
                  </span>
                  <div className="space-y-3 rounded border border-border bg-surface p-3 text-sm">
                    <div className="flex items-center">
                      <span className="mr-2 font-medium text-foreground">Status:</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          report.content.report.verifiedQuotes.verified
                            ? "bg-success/12 text-success"
                            : "bg-failure/12 text-failure",
                        )}
                      >
                        {report.content.report.verifiedQuotes.verified
                          ? "Verified"
                          : "Not Verified"}
                      </span>
                    </div>

                    {report.content.report.verifiedQuotes.missingQuotes.length > 0 && (
                      <div className="border-t border-border pt-2">
                        <span className="font-medium text-foreground">Missing Quotes:</span>
                        <ul className="mt-2 list-disc space-y-1.5 pl-5">
                          {report.content.report.verifiedQuotes.missingQuotes.map(
                            (quote: string) => (
                              <li
                                key={`${report.id}-${quote}`}
                                className="rounded border border-border bg-surface-elevated p-2 text-foreground"
                              >
                                "{quote}"
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetadataItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col border-b border-border py-1.5 last:border-0 sm:flex-row sm:items-start">
      <span className="mb-1 w-32 flex-shrink-0 font-medium text-foreground sm:mb-0">{label}:</span>
      <span className="min-w-0 break-words text-muted-foreground">{children}</span>
    </div>
  );
}
