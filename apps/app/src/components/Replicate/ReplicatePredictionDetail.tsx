import { useReplicatePrediction } from "~/hooks/useReplicate";
import { Card } from "~/components/ui";

interface ReplicatePredictionDetailProps {
  predictionId: string;
}

export function ReplicatePredictionDetail({
  predictionId,
}: ReplicatePredictionDetailProps) {
  const {
    data: prediction,
    isLoading,
    error,
  } = useReplicatePrediction(predictionId);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" />
      </div>
    );
  }

  if (error || !prediction) {
    return (
      <div className="p-4 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800">
        <h3 className="font-semibold mb-2">Failed to load prediction</h3>
        <p>Please try again later.</p>
      </div>
    );
  }

  const statusColors = {
    processing:
      "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
    succeeded:
      "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
    failed: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            {prediction.modelName || prediction.modelId}
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            {new Date(prediction.created_at).toLocaleString()}
          </p>
        </div>
        <span
          className={`px-4 py-2 text-sm font-medium rounded-full ${
            statusColors[prediction.status as keyof typeof statusColors]
          }`}
        >
          {prediction.status}
        </span>
      </div>

      {prediction.status === "processing" && (
        <Card className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-800 dark:border-yellow-200"></div>
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                Processing
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Your prediction is being processed. This page will automatically
                update when complete.
              </p>
            </div>
          </div>
        </Card>
      )}

      {prediction.status === "failed" && prediction.error && (
        <Card className="p-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
            Prediction Failed
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300">
            {prediction.error}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {prediction.status === "succeeded" &&
          (prediction.output ||
            prediction.predictionData?.output ||
            prediction.predictionData?.response) && (
            <Card className="p-6 lg:col-span-2 order-2 lg:order-1">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Output
              </h2>
              <OutputRenderer
                output={
                  prediction.output ||
                  prediction.predictionData?.response ||
                  prediction.predictionData?.output
                }
              />
            </Card>
          )}

        <Card
          className={`p-6 order-1 lg:order-2 ${prediction.status === "succeeded" && (prediction.output || prediction.predictionData?.output || prediction.predictionData?.response) ? "" : "lg:col-span-3"}`}
        >
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Input Parameters
          </h2>
          <div className="space-y-3">
            {Object.entries(prediction.input || {}).map(([key, value]) => (
              <div key={key} className="flex flex-col">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {key}:
                </span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400 break-all font-mono bg-zinc-100 dark:bg-zinc-900 p-2 rounded">
                  {typeof value === "object"
                    ? JSON.stringify(value, null, 2)
                    : String(value)}
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
  output: any;
}

function OutputRenderer({ output }: OutputRendererProps) {
  if (Array.isArray(output)) {
    return (
      <div className="space-y-4">
        {output.map((item, index) => {
          if (item && typeof item === "object" && "type" in item) {
            if (item.type === "text") {
              return (
                <div key={index} className="prose dark:prose-invert max-w-none">
                  {item.text}
                </div>
              );
            }
            if (item.type === "image_url" && item.image_url?.url) {
              return <OutputItem key={index} item={item.image_url.url} />;
            }
            if (item.type === "audio_url" && item.audio_url?.url) {
              return <OutputItem key={index} item={item.audio_url.url} />;
            }
            if (item.type === "video_url" && item.video_url?.url) {
              return <OutputItem key={index} item={item.video_url.url} />;
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
    <pre className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded-lg overflow-auto text-sm font-mono">
      {JSON.stringify(output, null, 2)}
    </pre>
  );
}

interface OutputItemProps {
  item: any;
}

function OutputItem({ item }: OutputItemProps) {
  const url = typeof item === "string" ? item : item?.url || item?.uri;

  if (!url) {
    return (
      <pre className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded-lg overflow-auto text-sm font-mono">
        {JSON.stringify(item, null, 2)}
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
        />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-blue-600 dark:text-blue-400 no-underline hover:underline text-sm"
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
          className="mt-2 inline-block text-blue-600 dark:text-blue-400 no-underline hover:underline text-sm"
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
          className="mt-2 inline-block text-blue-600 dark:text-blue-400 no-underline hover:underline text-sm"
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
      className="text-blue-600 dark:text-blue-400 hover:underline break-all"
    >
      {url}
    </a>
  );
}
