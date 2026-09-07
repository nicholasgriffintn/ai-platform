import { ButtonLink, PetPreview } from "@ngriffin_uk/polychat-component-ui";
import { PET_FLOCK } from "@ngriffin_uk/polychat-library-react";

import { DiscoverBand } from "../DiscoverBand";

export function PetsBand() {
  return (
    <DiscoverBand
      id="pets"
      eyebrow="Company"
      title="Meet the flock"
      lede="A pet perches above the composer and reacts to whatever Polychat is doing. Four parrots that used to be logos, and a few strays that turned up on their own."
      actions={
        <ButtonLink variant="outline" href="/pets">
          Visit the pets
        </ButtonLink>
      }
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PET_FLOCK.members.map((member) => (
          <li
            key={member.slug}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-4 text-center"
          >
            <span className="flex h-20 w-20 items-end justify-center overflow-hidden">
              <PetPreview
                sheetUrl={member.sheetUrl}
                label={`${member.name}, animated`}
                size={64}
                deferLoading
              />
            </span>
            <span className="text-sm font-medium text-foreground">{member.name}</span>
            <span className="text-xs text-muted-foreground">{member.tagline}</span>
          </li>
        ))}
      </ul>
    </DiscoverBand>
  );
}
