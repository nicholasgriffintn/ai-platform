import { MediaPlayer } from "@ngriffin_uk/polychat-component-ui";

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
      <MediaPlayer
        kind="video"
        src={data.videoUrl}
        title={data.title}
        crossOrigin="use-credentials"
      />
    </div>
  );
}
