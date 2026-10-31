import { Button, MediaTransport, cn } from "@ngriffin_uk/polychat-component-ui";
import { getSourceListenPassageUrl } from "@ngriffin_uk/polychat-library-client";
import { useSource, useSourceMediaActions } from "@ngriffin_uk/polychat-library-react";
import { readSourceListen, type Source } from "@ngriffin_uk/polychat-schemas";
import {
  formatRoundedMinutes,
  getErrorMessage,
  getWordCount,
} from "@ngriffin_uk/polychat-utility-core";
import { usePassagePlayback } from "@ngriffin_uk/polychat-utility-react";
import { Headphones } from "lucide-react";

const SPOKEN_WORDS_PER_SECOND = 2.5;

export function SourceListen({ source, className }: { source: Source; className?: string }) {
  const actions = useSourceMediaActions(source.id);
  const listen = readSourceListen(source.metadata);
  const passages = listen?.passages ?? [];
  const playback = usePassagePlayback(
    listen ? `${source.id}:${listen.contentHash}` : null,
    passages,
    listen?.status === "ready",
  );
  const { audible, step, playing, phase, toggle, seek } = playback;
  const { attach: attachPassage, buffering } = playback.track;
  const current = passages[Math.min(step, passages.length - 1)];
  const words = passages.reduce((total, passage) => total + getWordCount(passage.text), 0);

  if (!listen || listen.status === "failed") {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <Button
          variant="outline"
          size="sm"
          icon={<Headphones size={14} />}
          isLoading={actions.listen.isPending}
          onClick={() => actions.listen.mutate()}
        >
          {listen?.status === "failed" ? "Try reading it aloud again" : "Listen"}
        </Button>
        {listen?.status === "failed" ? (
          <span className="text-xs text-muted-foreground">Reading aloud didn't finish.</span>
        ) : null}
        {actions.listen.error ? (
          <span className="text-xs text-failure">
            {getErrorMessage(actions.listen.error, "It couldn't be read aloud")}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 rounded-2xl border border-border bg-surface p-3",
        className,
      )}
    >
      {audible ? (
        <audio
          key={`${listen.contentHash}:${step}`}
          ref={attachPassage}
          preload="auto"
          autoPlay={playing}
          crossOrigin="use-credentials"
          src={getSourceListenPassageUrl(source.id, step)}
        >
          <track kind="captions" />
        </audio>
      ) : null}
      <MediaTransport
        playing={playing}
        busy={phase === "waiting" || buffering}
        onToggle={toggle}
        value={Math.min(step, passages.length)}
        max={passages.length}
        onSeek={(value) => seek(Math.floor(value))}
        caption={playing && current ? current.text : undefined}
        start={
          passages[0]?.audio
            ? `Passage ${Math.min(step + 1, passages.length)} of ${passages.length}`
            : "Getting the first passage ready"
        }
        end={formatRoundedMinutes(words / SPOKEN_WORDS_PER_SECOND)}
      />
    </div>
  );
}

export function SourceListenById({ sourceId }: { sourceId: string }) {
  const source = useSource(sourceId).data;

  return source ? <SourceListen source={source} /> : null;
}
