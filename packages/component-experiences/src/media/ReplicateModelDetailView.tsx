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
        <h1 className="text-3xl font-bold text-foreground mb-2">{model.name}</h1>
        <p className="text-muted-foreground mb-4">{model.description}</p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-active-work/12 text-active-work text-sm rounded-full"
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

      <div className="border-border bg-surface rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Model Parameters</h2>
        {form}
        {errorMessage && (
          <div className="mt-4 bg-failure/12 border border-failure/45 rounded-lg p-4">
            <p className="text-failure">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
