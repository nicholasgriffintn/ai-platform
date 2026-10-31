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
  dockHref,
  researching = false,
  eyebrow,
  title,
  subtitle,
  idleMessage,
  artBackground,
  isRecording = false,
  recordError,
  onRecord,
  onPlayingChange,
}: {
  sourceId: string | undefined;
  dockHref?: string;
  researching?: boolean;
  eyebrow: string;
  title: string;
  subtitle: string;
  idleMessage: string;
  artBackground: string;
  isRecording?: boolean;
  recordError?: unknown;
  onRecord?: () => void;
  onPlayingChange: (playing: boolean) => void;
}) {
  const source = useSource(sourceId ?? null).data;
  const status = listenStatus(sourceId, source, researching);
  const action = (icon: ReactNode, label: string) =>
    onRecord ? (
      <MediaNoticeAction icon={icon} label={label} disabled={isRecording} onClick={onRecord} />
    ) : undefined;

  return (
    <DiscoverStage eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <SourcePlayer
        sourceId={sourceId ?? null}
        title={title}
        artBackground={artBackground}
        dock={dockHref ? { href: dockHref, subtitle: eyebrow } : undefined}
        onPlayingChange={onPlayingChange}
        notice={
          status.state === "idle" ? (
            <MediaNotice
              status={status}
              message={idleMessage}
              action={action(<Headphones size={15} aria-hidden />, "Record it")}
            />
          ) : sourceId && !source && !researching ? (
            <MediaNotice status={status} message="Getting the recording ready." />
          ) : status.state === "making" ? (
            <MediaNotice
              status={status}
              message={
                researching
                  ? "Researching today's topics first, then recording. It plays here when it's done, so carry on with the edition."
                  : "Recording. It plays here when it's done, so carry on with the edition."
              }
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
