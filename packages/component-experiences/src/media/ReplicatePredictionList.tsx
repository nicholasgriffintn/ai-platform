import { Card, Link } from "@ngriffin_uk/polychat-component-ui";

export interface ReplicatePredictionSummary {
  id: string;
  status?: string;
  created_at?: string;
  modelId?: string;
  modelName?: string;
  input?: Record<string, any>;
  error?: any;
  [key: string]: any;
}

export interface ReplicatePredictionListProps {
  predictions: ReplicatePredictionSummary[];
  basePath: string;
}

export function ReplicatePredictionList({ predictions, basePath }: ReplicatePredictionListProps) {
  return (
    <div className="space-y-4">
      {predictions.map((prediction) => (
        <PredictionCard key={prediction.id} basePath={basePath} prediction={prediction} />
      ))}
    </div>
  );
}

interface PredictionCardProps {
  basePath: string;
  prediction: ReplicatePredictionSummary;
}

function PredictionCard({ basePath, prediction }: PredictionCardProps) {
  const statusColors: Record<string, string> = {
    processing: "bg-attention/12 text-attention",
    succeeded: "bg-success/12 text-success",
    completed: "bg-success/12 text-success",
    failed: "bg-failure/12 text-failure",
  };

  return (
    <Link
      href={`${basePath}/predictions/${prediction.id}`}
      className="group block no-underline hover:!no-underline"
    >
      <Card className="p-6 hover:shadow-lg transition-all">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground group-hover:underline mb-1 break-words">
              {String(prediction.input?.prompt || prediction.modelName || prediction.modelId || "")}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">
                {prediction.modelName || prediction.modelId || ""}
              </span>
              <span>•</span>
              <span>
                {prediction.created_at ? new Date(prediction.created_at).toLocaleString() : ""}
              </span>
            </div>
          </div>
          <span
            className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap shrink-0 ${
              statusColors[prediction.status ?? ""]
            }`}
          >
            {prediction.status}
          </span>
        </div>

        {prediction.status === "processing" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-border-strong" />
            <span>Processing...</span>
          </div>
        )}

        {prediction.status === "failed" && !!prediction.error && (
          <p className="text-sm text-failure">Error: {String(prediction.error)}</p>
        )}
      </Card>
    </Link>
  );
}
