import { cn } from "@ngriffin_uk/polychat-component-ui";
import { formatComparisonCost } from "@ngriffin_uk/polychat-library-chat/response-stats";
import { comparisonResultSchema, type ComparisonAnswer } from "@ngriffin_uk/polychat-schemas";

import { MemoizedMarkdown } from "../../markdown";

function ComparisonAnswerCard({ answer }: { answer: ComparisonAnswer }) {
  return (
    <div className="min-w-0 space-y-1 rounded-md border border-border p-2.5">
      <div className="flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{answer.name}</span>
        {answer.isOriginal && <span>Original answer</span>}
      </div>
      <MemoizedMarkdown className="max-h-64 max-w-none overflow-y-auto text-sm">
        {answer.content}
      </MemoizedMarkdown>
    </div>
  );
}

export function ComparisonView({ data, embedded }: { data: unknown; embedded: boolean }) {
  const parsed = comparisonResultSchema.safeParse(data);

  if (!parsed.success) {
    return null;
  }

  const { agreements, answers, disagreements, spend } = parsed.data;

  return (
    <div className={cn("space-y-2", embedded ? "" : "my-2")}>
      <div className="flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Compared {answers.length} answers</span>
        <span className="tabular-nums" data-testid="comparison-cost">
          {formatComparisonCost(spend)}
        </span>
      </div>
      {agreements.length > 0 && (
        <section className="space-y-1">
          <h4 className="text-xs font-medium text-foreground">Where they agree</h4>
          <ul className="list-disc space-y-0.5 pl-4 text-sm">
            {agreements.map((agreement) => (
              <li key={agreement}>{agreement}</li>
            ))}
          </ul>
        </section>
      )}
      {disagreements.length > 0 && (
        <section className="space-y-1">
          <h4 className="text-xs font-medium text-foreground">Where they disagree</h4>
          <ul className="space-y-1.5 text-sm">
            {disagreements.map(({ point, positions }) => (
              <li key={point}>
                <p>{point}</p>
                <ul className="list-disc pl-4 text-muted-foreground">
                  {positions.map(({ model, position }) => (
                    <li key={model}>
                      <span className="font-medium text-foreground">{model}:</span> {position}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
          Answers side by side
        </summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {answers.map((answer) => (
            <ComparisonAnswerCard key={answer.name} answer={answer} />
          ))}
        </div>
      </details>
    </div>
  );
}
