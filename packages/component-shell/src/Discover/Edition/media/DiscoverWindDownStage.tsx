import {
  Button,
  DropdownMenu,
  DropdownMenuItem,
  MediaBalance,
  MediaNotice,
  MediaNoticeAction,
  MediaStage,
  MediaTransport,
} from "@ngriffin_uk/polychat-component-ui";
import {
  getDiscoverWindDownBedUrl,
  getDiscoverWindDownStepUrl,
} from "@ngriffin_uk/polychat-library-client";
import {
  useDiscoverWindDown,
  useDiscoverWindDownTonight,
  useStartDiscoverWindDown,
  useWindDownMixStore,
} from "@ngriffin_uk/polychat-library-react";
import {
  DISCOVER_WIND_DOWN_AFTER_VOICE_MINUTES,
  type CreateDiscoverWindDown,
} from "@ngriffin_uk/polychat-schemas";
import {
  balanceGains,
  clampNumber,
  formatTranscriptTimestamp,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-core";
import {
  useAmbientBed,
  useCrossfadeLoop,
  useMediaVolume,
  useRunningSeconds,
} from "@ngriffin_uk/polychat-utility-react";
import { Check, Leaf, Mic, MoonStar, Plus, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { DiscoverStage } from "./DiscoverStage.js";
import { DiscoverWindDownChooser } from "./DiscoverWindDownChooser.js";
import { DiscoverWindDownVisual } from "./DiscoverWindDownVisual.js";
import { windDownStatus } from "./media-status.js";
import { useWindDownPlayback, type WindDownPhase } from "./useWindDownPlayback.js";
import { WIND_DOWN_KIND_LABELS } from "./wind-down-choices.js";

const SOUND_LEVEL = 0.35;
const TAIL_FADE_SECONDS = 45;

function afterVoiceLabel(minutes: number): string {
  return minutes === 0 ? "Sound stops with the voice" : `Sound plays on for ${minutes} min`;
}

function phaseText(
  phase: WindDownPhase,
  text: string | undefined,
  choosing: boolean,
  soundOnly: boolean,
) {
  switch (phase) {
    case "idle":
      return choosing ? "Pick a session below." : "Press play when you're settled.";
    case "waiting":
      return "Settling in.";
    case "finished":
      return "That's all. Have a good evening.";
    default:
      return soundOnly ? null : (text ?? null);
  }
}

export function DiscoverWindDownStage({
  windDownId,
  story,
  onClose,
  onPlayingChange,
}: {
  windDownId: string | null;
  story?: { retrying: boolean; onRetry: () => void };
  onClose: () => void;
  onPlayingChange: (playing: boolean) => void;
}) {
  const windDown = useDiscoverWindDown(windDownId).data;
  const start = useStartDiscoverWindDown();
  const playback = useWindDownPlayback(windDown);
  const [choosing, setChoosing] = useState(!windDownId);
  const tonight = useDiscoverWindDownTonight(choosing).data;
  const mix = useWindDownMixStore();
  const status = windDownStatus(windDown);
  const soundOnly = windDown?.kind === "sound";
  const gains = balanceGains(mix.balance);
  const tailTotal = mix.afterVoiceMinutes * 60;
  const tailSeconds = useRunningSeconds(
    playback.ended && tailTotal > 0,
    `${windDown?.id ?? ""}:${playback.run}`,
  );
  const tailLevel = clampNumber((tailTotal - tailSeconds) / TAIL_FADE_SECONDS, 0, 1);
  const soundPlaying = playback.wantsPlay || (playback.ended && tailLevel > 0);
  const soundLevel = SOUND_LEVEL * gains.left * (playback.ended ? tailLevel : 1);
  const [missingBed, setMissingBed] = useState<string | null>(null);
  const hasBed = windDown?.ambient === true && missingBed !== windDown.bed;
  const attachVoice = useMediaVolume(playback.track.attach, gains.right);

  useCrossfadeLoop(
    windDown && hasBed ? getDiscoverWindDownBedUrl(windDown.bed) : null,
    soundPlaying,
    soundLevel,
    () => setMissingBed(windDown?.bed ?? null),
  );
  useAmbientBed(soundPlaying && !hasBed, gains.left * (playback.ended ? tailLevel : 1));
  useEffect(() => onPlayingChange(soundPlaying), [onPlayingChange, soundPlaying]);

  const begin = (input: CreateDiscoverWindDown) => {
    playback.begin();
    setChoosing(false);
    start.mutate(input, { onError: () => setChoosing(true) });
  };

  return (
    <DiscoverStage
      eyebrow={story ? "Tonight's story" : "Wind down"}
      title={!choosing && windDown ? windDown.title : "Something quieter"}
      subtitle="A calm voice, or none, over a quiet sound. Slide between the two."
      onClose={onClose}
    >
      <MediaStage
        visual={
          <>
            <DiscoverWindDownVisual
              phase={playback.phase}
              text={phaseText(playback.phase, playback.current?.text, choosing, soundOnly)}
              bed={windDown?.bed ?? tonight?.bed ?? "night"}
              kind={choosing ? null : (windDown?.kind ?? null)}
              seed={windDown?.id ?? "wind-down"}
            />
            <div className="absolute inset-x-0 top-0 px-4 pt-3 sm:px-8 sm:pt-5">
              <MediaBalance
                tone="overlay"
                className="mx-auto max-w-md"
                value={mix.balance}
                onChange={mix.setBalance}
                left={{ label: "Sound", icon: <Leaf size={16} aria-hidden /> }}
                right={{ label: "Voice", icon: <Mic size={16} aria-hidden /> }}
              />
            </div>
            {status.state === "failed" && !choosing && (
              <MediaNotice
                status={status}
                message="That session didn't take."
                action={
                  <MediaNoticeAction
                    icon={<RotateCcw size={15} aria-hidden />}
                    label="Try again"
                    disabled={story ? story.retrying : start.isPending}
                    onClick={() =>
                      story
                        ? story.onRetry()
                        : begin({
                            kind: windDown?.kind ?? "breathing",
                            minutes: windDown?.minutes ?? 10,
                            ...(windDown?.topic ? { topic: windDown.topic } : {}),
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
            {windDown && playback.audible ? (
              <audio
                key={`${windDown.id}:${playback.step}`}
                ref={attachVoice}
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
              value={playback.position.value}
              max={playback.position.max}
              onSeek={soundOnly ? undefined : (value) => playback.seek(Math.floor(value))}
              start={
                soundOnly
                  ? formatTranscriptTimestamp(playback.position.value)
                  : playback.position.max
                    ? `Step ${Math.min(playback.step + 1, playback.position.max)} of ${playback.position.max}`
                    : "Getting ready"
              }
              end={windDown ? `${windDown.minutes} min` : ""}
              actions={
                <>
                  <DropdownMenu
                    position="top"
                    buttonProps={{
                      "aria-label": afterVoiceLabel(mix.afterVoiceMinutes),
                      title: afterVoiceLabel(mix.afterVoiceMinutes),
                      size: "sm",
                      variant: "outline",
                    }}
                    trigger={
                      <span className="flex items-center gap-1.5">
                        <MoonStar size={14} aria-hidden />
                        {mix.afterVoiceMinutes === 0
                          ? "Sound after: off"
                          : `Sound after: ${mix.afterVoiceMinutes} min`}
                      </span>
                    }
                  >
                    {DISCOVER_WIND_DOWN_AFTER_VOICE_MINUTES.map((minutes) => (
                      <DropdownMenuItem
                        key={minutes}
                        icon={
                          minutes === mix.afterVoiceMinutes ? (
                            <Check size={14} aria-hidden />
                          ) : (
                            <span className="size-3.5" />
                          )
                        }
                        onClick={() => mix.setAfterVoiceMinutes(minutes)}
                      >
                        {afterVoiceLabel(minutes)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenu>
                  {!choosing && !story && (
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
            tonight={tonight}
            isStarting={start.isPending}
            onBegin={begin}
            onCancel={windDown ? () => setChoosing(false) : undefined}
          />
        ) : windDown?.parked?.length ? (
          <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
            <h3 className="polychat-eyebrow">Waiting for the morning</h3>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
              {windDown.parked.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : windDown ? (
          <p className="px-1 text-xs text-muted-foreground">
            {WIND_DOWN_KIND_LABELS[windDown.kind].detail}
            {windDown.part && windDown.topic
              ? ` · Part ${windDown.part} about ${windDown.topic}`
              : ""}
          </p>
        ) : null}
      </MediaStage>
    </DiscoverStage>
  );
}
