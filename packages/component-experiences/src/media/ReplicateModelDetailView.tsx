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
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">{model.name}</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">{model.description}</p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Cost: ${model.costPerRun} per run
          {model.reference && (
            <>
              {" • "}
              <a
                href={model.reference}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 no-underline hover:underline"
              >
                View documentation
              </a>
            </>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Model Parameters
        </h2>
        {form}
        {errorMessage && (
          <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
