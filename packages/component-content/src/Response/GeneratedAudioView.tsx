import type { GeneratedAudioResponseData } from "./response-data";

interface GeneratedAudioViewProps {
  data: GeneratedAudioResponseData;
}

export function GeneratedAudioView({ data }: GeneratedAudioViewProps) {
  return (
    <div data-responsetype="generated-audio" className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{data.title}</h2>
      {data.content && <p className="text-sm text-foreground">{data.content}</p>}
      <div className="rounded-lg border border-border bg-surface-elevated p-3">
        <audio controls crossOrigin="use-credentials" className="w-full rounded-lg">
          <source src={data.audioUrl} type="audio/mpeg" />
          <track kind="captions" />
          Your browser does not support the audio element.
        </audio>
      </div>
    </div>
  );
}
