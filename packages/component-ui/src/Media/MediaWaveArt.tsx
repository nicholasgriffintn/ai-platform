import { cn } from "../utils";

const BAR_HEIGHTS = [0.5, 0.8, 1, 0.65, 0.9, 0.45, 0.75];

export const MEDIA_ART_GRADIENT =
  "radial-gradient(110% 80% at 80% 0%, #6366f199 0%, transparent 55%), radial-gradient(90% 80% at 0% 100%, #0e7490 0%, transparent 65%), linear-gradient(150deg, #1e293b 0%, #020617 100%)";

export function MediaWaveArt({
  playing,
  background = MEDIA_ART_GRADIENT,
  image,
  crossOrigin,
}: {
  playing: boolean;
  background?: string;
  image?: string | null;
  crossOrigin?: "anonymous" | "use-credentials";
}) {
  return (
    <>
      <div aria-hidden className="absolute inset-0" style={{ background }} />
      {image ? (
        <>
          <img
            src={image}
            crossOrigin={crossOrigin}
            alt=""
            className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-2xl"
          />
          <img
            src={image}
            crossOrigin={crossOrigin}
            alt=""
            className="absolute top-1/2 left-1/2 aspect-square h-3/5 -translate-x-1/2 -translate-y-[60%] rounded-2xl object-cover shadow-2xl"
          />
        </>
      ) : (
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 flex h-16 -translate-x-1/2 -translate-y-[60%] items-end gap-1.5"
        >
          {BAR_HEIGHTS.map((height, index) => (
            <span
              key={String(height)}
              className={cn(
                "w-2 origin-bottom rounded-full bg-white/80",
                playing && "animate-pulse motion-reduce:animate-none",
              )}
              style={{ height: `${height * 100}%`, animationDelay: `${index * 120}ms` }}
            />
          ))}
        </div>
      )}
    </>
  );
}
