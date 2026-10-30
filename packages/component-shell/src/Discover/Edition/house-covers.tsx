import { cn } from "@ngriffin_uk/polychat-component-ui";
import { DISCOVER_HOUSE_COVER_PREFIX } from "@ngriffin_uk/polychat-schemas";
import { Cpu, NotebookPen, Sunrise, UsersRound, type LucideIcon } from "lucide-react";

interface HouseCoverArt {
  icon: LucideIcon;
  from: string;
  to: string;
  glow: string;
}

const HOUSE_COVERS: Record<string, HouseCoverArt> = {
  models: { icon: Cpu, from: "#0f3d3e", to: "#071a1b", glow: "#2dd4bf" },
  teammates: { icon: UsersRound, from: "#3b1d5a", to: "#140a21", glow: "#c084fc" },
  notebooks: { icon: NotebookPen, from: "#5a3a12", to: "#1f1407", glow: "#fbbf24" },
  discover: { icon: Sunrise, from: "#5b1f2e", to: "#1d0a10", glow: "#fb7185" },
};

export function isHouseCover(coverId: string | undefined): coverId is string {
  return typeof coverId === "string" && coverId.startsWith(DISCOVER_HOUSE_COVER_PREFIX);
}

export function HouseCover({ coverId, className }: { coverId: string; className?: string }) {
  const art = HOUSE_COVERS[coverId.slice(DISCOVER_HOUSE_COVER_PREFIX.length)];

  if (!art) {
    return null;
  }

  const Icon = art.icon;

  return (
    <div
      aria-hidden
      className={cn("relative size-full overflow-hidden", className)}
      style={{
        background: `radial-gradient(70% 55% at 80% 15%, ${art.glow}55 0%, transparent 65%), linear-gradient(165deg, ${art.from} 0%, ${art.to} 100%)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: `radial-gradient(${art.glow} 0.9px, transparent 1px)`,
          backgroundSize: "14px 14px",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.9) 0%, transparent 70%)",
        }}
      />
      <Icon
        className="absolute top-5 right-5 size-[42%] text-white/90 drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        strokeWidth={1.25}
        style={{ color: art.glow }}
      />
    </div>
  );
}
