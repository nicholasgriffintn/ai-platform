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
      <h2 className="text-lg font-semibold text-foreground">{data.title}</h2>
      {data.content && <p className="text-sm text-foreground">{data.content}</p>}
      <div className="overflow-hidden rounded-lg border border-border">
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
