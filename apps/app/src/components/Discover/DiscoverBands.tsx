import { cn } from "@ngriffin_uk/polychat-component-ui";

import { CapabilitiesBand } from "./bands/CapabilitiesBand";
import { ChatAndWorkBand } from "./bands/ChatAndWorkBand";
import { KeysBand } from "./bands/KeysBand";
import { ModelsBand } from "./bands/ModelsBand";
import { PetsBand } from "./bands/PetsBand";
import { PricingBand } from "./bands/PricingBand";
import { DISCOVER_SECTIONS } from "./discover-sections";

export interface DiscoverBandsProps {
  variant: "home" | "page";
}

function DiscoverSectionNav() {
  return (
    <nav aria-label="Discover sections" className="flex flex-wrap gap-2">
      {DISCOVER_SECTIONS.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="bg-surface border-border text-muted-foreground hover:border-border-strong hover:text-foreground rounded-full border px-3 py-1 text-xs font-medium no-underline transition-colors"
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}

export function DiscoverBands({ variant }: DiscoverBandsProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-5xl px-4 sm:px-6",
        variant === "home" && "border-border mt-16 border-t pt-12 pb-8",
      )}
    >
      {variant === "page" && (
        <header className="mb-12 space-y-5">
          <p className="polychat-eyebrow">A short tour</p>
          <h1 className="font-display text-foreground text-4xl font-medium tracking-tight text-balance md:text-5xl">
            What Polychat is for
          </h1>
          <p className="text-muted-foreground max-w-prose text-lg leading-relaxed">
            One place to talk to every model, keep what comes of it, and bring other people in when
            a question grows into a project.
          </p>
          <DiscoverSectionNav />
        </header>
      )}
      {variant === "home" && <p className="polychat-eyebrow mb-8">Keep scrolling for the tour</p>}
      <ChatAndWorkBand />
      <ModelsBand />
      <CapabilitiesBand />
      <PetsBand />
      <PricingBand />
      <KeysBand />
    </div>
  );
}
