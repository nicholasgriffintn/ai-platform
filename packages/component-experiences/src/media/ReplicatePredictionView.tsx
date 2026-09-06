import { Card, SignInEmptyState, textLinkClassName } from "@ngriffin_uk/polychat-component-ui";
import {
  formatUnknownValue,
  getStringProperty,
  isRecord,
} from "@ngriffin_uk/polychat-utility-core";

export interface ReplicatePrediction {
  status?: string;
  created_at?: string;
  createdAt?: string;
  input?: any;
  output?: any;
  response?: any;
  error?: any;
  [key: string]: any;
}

export interface ReplicatePredictionViewProps {
  prediction?: ReplicatePrediction | null;
  isLoading?: boolean;
  requiresSignIn?: boolean;
  hasError?: boolean;
  onSignIn: () => void;
}

export function ReplicatePredictionView({
  prediction,
  isLoading = false,
  requiresSignIn = false,
  hasError = false,
  onSignIn,
}: ReplicatePredictionViewProps) {
  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-active-work" />
      </div>
    );
  }

  if (hasError || requiresSignIn || !prediction) {
    if (requiresSignIn) {
      return (
        <SignInEmptyState
          title="Sign in to view this prediction"
          message="Sign in to access this Replicate prediction."
          className="min-h-[300px]"
          onSignIn={onSignIn}
        />
      );
    }

    return (
      <div className="rounded-md border border-attention/45 bg-attention/12 p-4 text-attention">
        <h3 className="mb-2 font-semibold">Failed to load prediction</h3>
        <p>Please try again later.</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    queued: "bg-attention/12 text-attention",
    starting: "bg-attention/12 text-attention",
    processing: "bg-attention/12 text-attention",
    in_progress: "bg-attention/12 text-attention",
    succeeded: "bg-success/12 text-success",
    completed: "bg-success/12 text-success",
    failed: "bg-failure/12 text-failure",
    canceled: "bg-selection text-muted-foreground",
  };
  const createdAt = prediction.created_at ?? prediction.createdAt;
  const prompt = getStringProperty(prediction.input, "prompt");
  const predictionOutput =
    prediction.output ?? prediction.predictionData?.response ?? prediction.predictionData?.output;
  const hasPredictionOutput =
    predictionOutput !== undefined && predictionOutput !== null && predictionOutput !== "";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="mb-2 text-3xl font-bold break-words text-foreground">
            {prompt || prediction.modelName || prediction.modelId}
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium">{prediction.modelName || prediction.modelId}</span>
            {createdAt && (
              <>
                <span>•</span>
                <span>{new Date(createdAt).toLocaleString()}</span>
              </>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap ${
            statusColors[prediction.status ?? ""] ?? "bg-selection text-muted-foreground"
          }`}
        >
          {prediction.status}
        </span>
      </div>

      {prediction.status === "processing" && (
        <Card className="border-attention/45 bg-attention/12 p-6">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-attention/45" />
            <div>
              <h3 className="font-semibold text-attention">Processing</h3>
              <p className="text-sm text-attention">
                Your prediction is being processed. This page will automatically update when
                complete.
              </p>
            </div>
          </div>
        </Card>
      )}

      {prediction.status === "failed" && prediction.error && (
        <Card className="border-failure/45 bg-failure/12 p-6">
          <h3 className="mb-2 font-semibold text-failure">Prediction Failed</h3>
          <p role="alert" className="text-sm text-failure">
            {prediction.error}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {(prediction.status === "succeeded" || prediction.status === "completed") &&
          hasPredictionOutput && (
            <Card className="order-2 p-6 lg:order-1 lg:col-span-2">
              <h2 className="mb-4 text-xl font-semibold text-foreground">Output</h2>
              <OutputRenderer output={predictionOutput} />
            </Card>
          )}

        <Card
          className={`order-1 p-6 lg:order-2 ${(prediction.status === "succeeded" || prediction.status === "completed") && hasPredictionOutput ? "" : "lg:col-span-3"}`}
        >
          <h2 className="mb-4 text-xl font-semibold text-foreground">Input Parameters</h2>
          <div className="space-y-3">
            {Object.entries(prediction.input || {}).map(([key, value]) => (
              <div key={key} className="flex flex-col">
                <span className="mb-1 text-sm font-medium text-foreground">{key}:</span>
                <span className="rounded bg-surface-elevated p-2 font-mono text-sm break-all text-muted-foreground">
                  {formatUnknownValue(value)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

interface OutputRendererProps {
  output: unknown;
}

function OutputRenderer({ output }: OutputRendererProps) {
  if (Array.isArray(output)) {
    return (
      <div className="space-y-4">
        {output.map((item, index) => {
          if (isRecord(item)) {
            if (item.type === "text") {
              return (
                <div key={index} className="prose max-w-none dark:prose-invert">
                  {getStringProperty(item, "text")}
                </div>
              );
            }

            if (item.type === "image_url") {
              const url = getStringProperty(item.image_url, "url");

              if (url) {
                return <OutputItem key={index} item={url} />;
              }
            }

            if (item.type === "audio_url") {
              const url = getStringProperty(item.audio_url, "url");

              if (url) {
                return <OutputItem key={index} item={url} />;
              }
            }

            if (item.type === "video_url") {
              const url = getStringProperty(item.video_url, "url");

              if (url) {
                return <OutputItem key={index} item={url} />;
              }
            }
          }

          return <OutputItem key={index} item={item} />;
        })}
      </div>
    );
  }

  if (typeof output === "string") {
    return <OutputItem item={output} />;
  }

  return (
    <pre className="overflow-auto rounded-lg bg-surface-elevated p-4 font-mono text-sm">
      {formatUnknownValue(output)}
    </pre>
  );
}

interface OutputItemProps {
  item: unknown;
}

function OutputItem({ item }: OutputItemProps) {
  const url =
    typeof item === "string"
      ? item
      : getStringProperty(item, "url") || getStringProperty(item, "uri");

  if (!url) {
    return (
      <pre className="overflow-auto rounded-lg bg-surface-elevated p-4 font-mono text-sm">
        {formatUnknownValue(item)}
      </pre>
    );
  }

  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  const isVideo = /\.(mp4|webm|mov)$/i.test(url);
  const isAudio = /\.(mp3|wav|ogg)$/i.test(url);

  if (isImage) {
    return (
      <div>
        <img
          src={url}
          alt="Generated output"
          className="max-w-full rounded-lg"
          decoding="async"
          loading="lazy"
        />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-active-work no-underline hover:underline"
        >
          Open in new tab →
        </a>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div>
        <video controls className="max-w-full rounded-lg">
          <source src={url} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-active-work no-underline hover:underline"
        >
          Open in new tab →
        </a>
      </div>
    );
  }

  if (isAudio) {
    return (
      <div>
        <audio controls className="w-full">
          <source src={url} />
          Your browser does not support the audio tag.
        </audio>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-active-work no-underline hover:underline"
        >
          Open in new tab →
        </a>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={textLinkClassName({ tone: "accent", className: "break-all" })}
    >
      {url}
    </a>
  );
}
