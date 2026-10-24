import { cn } from "@ngriffin_uk/polychat-component-ui";
import { getDiscoverEpisodeShotUrl } from "@ngriffin_uk/polychat-library-client";
import type { DiscoverEpisode, DiscoverEpisodeChapter } from "@ngriffin_uk/polychat-schemas";

import { discoverTopicGradient } from "../Edition/DiscoverTopicTile.js";
import { locateEpisodeShot, nextEpisodeShot } from "./episode-timeline.js";
import { useShotFrames } from "./useShotFrames.js";

const KEN_BURNS = `
@keyframes discover-shot-push_in { from { transform: scale(1); } to { transform: scale(1.12); } }
@keyframes discover-shot-pull_back { from { transform: scale(1.14); } to { transform: scale(1); } }
@keyframes discover-shot-pan_left { from { transform: scale(1.12) translateX(4%); } to { transform: scale(1.12) translateX(-4%); } }
@keyframes discover-shot-pan_right { from { transform: scale(1.12) translateX(-4%); } to { transform: scale(1.12) translateX(4%); } }
@keyframes discover-shot-hold { from { transform: scale(1.02); } to { transform: scale(1.05); } }
`;

export function EpisodeVisual({
  episode,
  chapter,
  chapterIndex,
  seconds,
  playing,
}: {
  episode: DiscoverEpisode | undefined;
  chapter: DiscoverEpisodeChapter | undefined;
  chapterIndex: number;
  seconds: number;
  playing: boolean;
}) {
  const position = chapter ? locateEpisodeShot(chapter, seconds) : null;
  const scene = position ? chapter?.scenes[position.scene] : undefined;
  const shot = position ? scene?.shots[position.shot] : undefined;
  const next = chapter && position ? nextEpisodeShot(chapter, position) : null;
  const nextShot = next ? chapter?.scenes[next.scene]?.shots[next.shot] : undefined;
  const { frames, isLoaded, markLoaded } = useShotFrames(
    episode && position && shot?.image
      ? {
          key: `${chapterIndex}-${position.scene}-${position.shot}`,
          src: getDiscoverEpisodeShotUrl(episode.id, {
            chapter: chapterIndex,
            scene: position.scene,
            shot: position.shot,
          }),
          animation: `discover-shot-${shot.motion} ${position.shotSeconds}s linear forwards`,
        }
      : null,
  );

  return (
    <>
      <style>{KEN_BURNS}</style>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: discoverTopicGradient(episode?.topic ?? "episode") }}
      />
      {frames.map((frame) => (
        <img
          key={frame.key}
          src={frame.src}
          crossOrigin="use-credentials"
          alt=""
          onLoad={() => markLoaded(frame.key)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-700 ease-out motion-reduce:animate-none",
            isLoaded(frame.key) ? "opacity-100" : "opacity-0",
          )}
          style={{
            animation: frame.animation,
            animationPlayState: playing ? "running" : "paused",
          }}
        />
      ))}
      {episode && next && nextShot?.image ? (
        <img
          aria-hidden
          alt=""
          crossOrigin="use-credentials"
          className="hidden"
          src={getDiscoverEpisodeShotUrl(episode.id, {
            chapter: chapterIndex,
            scene: next.scene,
            shot: next.shot,
          })}
        />
      ) : null}
      {chapter?.status === "ready" && scene ? (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-6 pt-12 pb-5 text-center">
          {scene.caption ? (
            <p className="rounded-md bg-black/55 px-3 py-1 text-sm text-white">{scene.caption}</p>
          ) : (
            <p className="text-xs font-medium tracking-[0.08em] text-white/70 uppercase">
              {scene.title}
            </p>
          )}
        </div>
      ) : null}
    </>
  );
}
