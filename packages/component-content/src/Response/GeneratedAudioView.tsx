import { MediaPlayer } from "@ngriffin_uk/polychat-component-ui";

import type { GeneratedAudioResponseData } from "./response-data";

interface GeneratedAudioViewProps {
  data: GeneratedAudioResponseData;
}

export function GeneratedAudioView({ data }: GeneratedAudioViewProps) {
  return (
    <div data-responsetype="generated-audio" className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{data.title}</h2>
      {data.content && <p className="text-sm text-foreground">{data.content}</p>}
      <MediaPlayer
        kind="audio"
        layout="compact"
        src={data.audioUrl}
        title={data.title}
        crossOrigin="use-credentials"
        className="rounded-2xl border border-border bg-surface-elevated p-3"
      />
    </div>
  );
}
