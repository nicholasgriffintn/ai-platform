import { textLinkClassName } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

export interface ReplicateModelDetailModel {
  name: string;
  description?: string;
  tags?: string[];
  modalityLabel?: string;
  costPerRun?: number | string;
  reference?: string;
}

export interface ReplicateModelDetailViewProps {
  model: ReplicateModelDetailModel;
  form: ReactNode;
  errorMessage?: string;
}

export function ReplicateModelDetailView({
  model,
  form,
  errorMessage,
}: ReplicateModelDetailViewProps) {
  const tags = [model.modalityLabel, ...(model.tags ?? [])].filter(Boolean) as string[];

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-foreground">{model.name}</h1>
        <p className="mb-4 text-muted-foreground">{model.description}</p>

        {tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-active-work/12 px-3 py-1 text-sm text-active-work"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          Cost: ${model.costPerRun} per run
          {model.reference && (
            <>
              {" • "}
              <a
                href={model.reference}
                target="_blank"
                rel="noopener noreferrer"
                className={textLinkClassName({ tone: "accent" })}
              >
                View documentation
              </a>
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-4 text-xl font-semibold text-foreground">Model Parameters</h2>
        {form}
        {errorMessage && (
          <div className="mt-4 rounded-lg border border-failure/45 bg-failure/12 p-4">
            <p className="text-failure">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
