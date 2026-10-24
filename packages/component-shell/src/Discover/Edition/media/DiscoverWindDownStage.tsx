import {
  Button,
  MediaNotice,
  MediaNoticeAction,
  MediaStage,
  MediaTransport,
} from "@ngriffin_uk/polychat-component-ui";
import {
  getDiscoverWindDownAmbientUrl,
  getDiscoverWindDownStepUrl,
} from "@ngriffin_uk/polychat-library-client";
import { useDiscoverWindDown, useStartDiscoverWindDown } from "@ngriffin_uk/polychat-library-react";
import type { CreateDiscoverWindDown } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useAmbientBed } from "@ngriffin_uk/polychat-utility-react";
import { Plus, RotateCcw, Waves } from "lucide-react";
import { useEffect, useState } from "react";

import { DiscoverStage } from "./DiscoverStage.js";
import { DiscoverWindDownChooser } from "./DiscoverWindDownChooser.js";
import { DiscoverWindDownVisual } from "./DiscoverWindDownVisual.js";
import { windDownStatus } from "./media-status.js";
import { useWindDownPlayback, type WindDownPhase } from "./useWindDownPlayback.js";
import { WindDownMusic } from "./WindDownMusic.js";

function phaseText(phase: WindDownPhase, text: string | undefined, choosing: boolean) {
  switch (phase) {
    case "idle":
      return choosing ? "Pick a session below." : "Press play when you're settled.";
    case "waiting":
      return "Settling in.";
    case "finished":
      return "That's all. Have a good evening.";
    default:
      return text ?? null;
  }
}

export function DiscoverWindDownStage({
  windDownId,
  onClose,
  onPlayingChange,
}: {
  windDownId: string | null;
  onClose: () => void;
  onPlayingChange: (playing: boolean) => void;
}) {
  const windDown = useDiscoverWindDown(windDownId).data;
  const start = useStartDiscoverWindDown();
  const playback = useWindDownPlayback(windDown);
  const [choosing, setChoosing] = useState(!windDownId);
  const [ambient, setAmbient] = useState(true);
  const status = windDownStatus(windDown);
  const total = windDown?.steps.length ?? 0;

  const hasMusic = windDown?.ambient === true;

  useAmbientBed(ambient && playback.wantsPlay && !hasMusic);
  useEffect(() => onPlayingChange(playback.wantsPlay), [onPlayingChange, playback.wantsPlay]);

  const begin = (input: CreateDiscoverWindDown) => {
    playback.begin();
    setChoosing(false);
    start.mutate(input, { onError: () => setChoosing(true) });
  };

  return (
    <DiscoverStage
      eyebrow="Wind down"
      title={!choosing && windDown ? windDown.title : "Something quieter"}
      subtitle="A guided session with a calm voice and quiet music underneath."
      onClose={onClose}
    >
      <MediaStage
        visual={
          <>
            <DiscoverWindDownVisual
              phase={playback.phase}
              text={phaseText(playback.phase, playback.current?.text, choosing)}
            />
            {status.state === "failed" && !choosing && (
              <MediaNotice
                status={status}
                message="That session didn't take."
                action={
                  <MediaNoticeAction
                    icon={<RotateCcw size={15} aria-hidden />}
                    label="Try again"
                    disabled={start.isPending}
                    onClick={() =>
                      begin({
                        kind: windDown?.kind ?? "breathing",
                        minutes: windDown?.minutes ?? 10,
                      })
                    }
                  />
                }
              />
            )}
          </>
        }
        transport={
          <>
            {windDown && hasMusic ? (
              <WindDownMusic
                src={getDiscoverWindDownAmbientUrl(windDown.id)}
                playing={ambient && playback.wantsPlay}
              />
            ) : null}
            {windDown && playback.audible ? (
              <audio
                key={`${windDown.id}:${playback.step}`}
                ref={playback.track.attach}
                preload="auto"
                autoPlay={playback.wantsPlay}
                crossOrigin="use-credentials"
                src={getDiscoverWindDownStepUrl(windDown.id, playback.step)}
              >
                <track kind="captions" />
              </audio>
            ) : null}
            <MediaTransport
              playing={playback.wantsPlay}
              busy={playback.phase === "waiting" || playback.track.buffering}
              disabled={!windDown || status.state === "failed"}
              onToggle={playback.phase === "finished" ? playback.begin : playback.toggle}
              value={Math.min(playback.step, total)}
              max={total}
              onSeek={(value) => playback.seekStep(Math.floor(value))}
              start={
                total ? `Step ${Math.min(playback.step + 1, total)} of ${total}` : "Getting ready"
              }
              end={windDown ? `${windDown.minutes} min` : ""}
              actions={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-pressed={ambient}
                    onClick={() => setAmbient((value) => !value)}
                  >
                    <Waves size={14} aria-hidden />
                    {ambient ? "Music on" : "Music off"}
                  </Button>
                  {!choosing && (
                    <Button variant="outline" size="sm" onClick={() => setChoosing(true)}>
                      <Plus size={14} aria-hidden />
                      New session
                    </Button>
                  )}
                </>
              }
            />
            {start.error ? (
              <p className="text-xs text-failure">
                {getErrorMessage(start.error, "The session could not be started")}
              </p>
            ) : null}
          </>
        }
      >
        {choosing ? (
          <DiscoverWindDownChooser
            initial={windDown ? { kind: windDown.kind, minutes: windDown.minutes } : null}
            isStarting={start.isPending}
            onBegin={begin}
            onCancel={windDown ? () => setChoosing(false) : undefined}
          />
        ) : null}
      </MediaStage>
    </DiscoverStage>
  );
}
