import { MediaNotice, MediaNoticeAction } from "@ngriffin_uk/polychat-component-ui";
import { useSource } from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { Headphones, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { SourcePlayer } from "../../../Media/SourcePlayer.js";
import { DiscoverStage } from "./DiscoverStage.js";
import { listenStatus } from "./media-status.js";

export function DiscoverListenStage({
  sourceId,
  eyebrow,
  title,
  subtitle,
  idleMessage,
  artBackground,
  isRecording = false,
  recordError,
  onRecord,
  onClose,
  onPlayingChange,
}: {
  sourceId: string | undefined;
  eyebrow: string;
  title: string;
  subtitle: string;
  idleMessage: string;
  artBackground: string;
  isRecording?: boolean;
  recordError?: unknown;
  onRecord?: () => void;
  onClose: () => void;
  onPlayingChange: (playing: boolean) => void;
}) {
  const source = useSource(sourceId ?? null).data;
  const status = listenStatus(sourceId, source);
  const action = (icon: ReactNode, label: string) =>
    onRecord ? (
      <MediaNoticeAction icon={icon} label={label} disabled={isRecording} onClick={onRecord} />
    ) : undefined;

  return (
    <DiscoverStage eyebrow={eyebrow} title={title} subtitle={subtitle} onClose={onClose}>
      <SourcePlayer
        sourceId={sourceId ?? null}
        title={title}
        artBackground={artBackground}
        onPlayingChange={onPlayingChange}
        notice={
          status.state === "idle" ? (
            <MediaNotice
              status={status}
              message={idleMessage}
              action={action(<Headphones size={15} aria-hidden />, "Record it")}
            />
          ) : status.state === "making" ? (
            <MediaNotice
              status={status}
              message="Recording. It plays here when it's done, so carry on with the edition."
            />
          ) : status.state === "failed" ? (
            <MediaNotice
              status={status}
              message="That recording didn't take."
              action={action(<RotateCcw size={15} aria-hidden />, "Try again")}
            />
          ) : null
        }
      />
      {recordError ? (
        <p className="text-xs text-failure">
          {getErrorMessage(recordError, "The recording could not be started")}
        </p>
      ) : null}
    </DiscoverStage>
  );
}
