interface GeneratedVideoViewProps {
  data: {
    title: string;
    content: string;
    videoUrl: string;
  };
}

export function GeneratedVideoView({ data }: GeneratedVideoViewProps) {
  return (
    <div data-responsetype="generated-video" className="space-y-3">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{data.title}</h2>
      {data.content && <p className="text-sm text-zinc-700 dark:text-zinc-300">{data.content}</p>}
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
        <video
          controls
          preload="metadata"
          crossOrigin="use-credentials"
          className="h-auto w-full"
          src={data.videoUrl}
        >
          <track kind="captions" />
          Your browser does not support the video element.
        </video>
      </div>
    </div>
  );
}
