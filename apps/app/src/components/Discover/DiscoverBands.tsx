import { cn } from "@ngriffin_uk/polychat-component-ui";

import { SectionNav } from "~/components/Core/SectionNav";

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

export function DiscoverBands({ variant }: DiscoverBandsProps) {
  return (
    <div
      className={cn("mx-auto w-full max-w-5xl px-4 sm:px-6", variant === "home" && "pt-10 pb-8")}
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
          <SectionNav label="Discover sections" sections={DISCOVER_SECTIONS} />
        </header>
      )}
      <ChatAndWorkBand />
      <ModelsBand />
      <CapabilitiesBand />
      <PetsBand />
      <PricingBand />
      <KeysBand />
    </div>
  );
}
