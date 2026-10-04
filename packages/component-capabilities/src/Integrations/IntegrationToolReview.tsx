import type { IntegrationTool } from "@ngriffin_uk/polychat-schemas";

export function IntegrationToolReview({
  previous,
  reviewed,
}: {
  previous?: IntegrationTool;
  reviewed: IntegrationTool;
}) {
  return (
    <details className="rounded-lg border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">Review {reviewed.name}</summary>
      {reviewed.description && (
        <p className="mt-2 text-sm text-muted-foreground">{reviewed.description}</p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {previous && (
          <div className="min-w-0">
            <h4 className="mb-1 text-xs font-medium">Saved parameters and behaviour</h4>
            <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
              {JSON.stringify(
                {
                  input: previous.inputSchema,
                  output: previous.outputSchema,
                  behaviour: previous.annotations,
                },
                null,
                2,
              )}
            </pre>
          </div>
        )}
        <div className="min-w-0">
          <h4 className="mb-1 text-xs font-medium">Parameters and behaviour</h4>
          <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
            {JSON.stringify(
              {
                input: reviewed.inputSchema,
                output: reviewed.outputSchema,
                behaviour: reviewed.annotations,
              },
              null,
              2,
            )}
          </pre>
        </div>
      </div>
    </details>
  );
}
