import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useOutput, useUIStore } from "@ngriffin_uk/polychat-library-react";
import { ArrowLeft, Maximize2 } from "lucide-react";

import { AudioOverviewStage } from "./AudioOverviewStage.js";
import type { OpenStudioItem } from "./studio-entries.js";
import { StudioSendToMenu } from "./StudioSendToMenu.js";
import { StudyOutputStage } from "./StudyOutputStage.js";

function OpenOutputStage({
  outputId,
  onAskAbout,
}: {
  outputId: string;
  onAskAbout: (topic: string) => void;
}) {
  const { data: output } = useOutput(outputId);

  return output ? <StudyOutputStage output={output} onAskAbout={onAskAbout} /> : null;
}

export function OpenStudioItemPanel({
  item,
  projectId,
  onBack,
  onAskAbout,
  onAsk,
}: {
  item: OpenStudioItem;
  projectId?: string;
  onBack: () => void;
  onAskAbout: (topic: string) => void;
  onAsk: (prompt: string) => void;
}) {
  const setOpenFile = useUIStore((state) => state.setOpenFile);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <Button variant="icon" aria-label="Back to Studio" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <h3 className="min-w-0 flex-1 truncate font-medium">{item.title}</h3>
        <StudioSendToMenu item={item} onAsk={onAsk} />
        <Button
          variant="icon"
          aria-label="Open larger"
          title="Open larger"
          onClick={() => setOpenFile({ origin: item.origin, id: item.id, projectId })}
        >
          <Maximize2 className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {item.origin === "output" ? (
          <OpenOutputStage outputId={item.id} onAskAbout={onAskAbout} />
        ) : (
          <AudioOverviewStage sourceId={item.id} />
        )}
      </div>
    </div>
  );
}
