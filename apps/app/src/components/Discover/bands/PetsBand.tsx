import { ButtonLink } from "@ngriffin_uk/polychat-component-ui";

import { PetPreview } from "~/components/Core/PetPreview";
import { PET_FLOCK } from "~/lib/pet/lore";

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
            className="bg-surface border-border flex flex-col items-center gap-2 rounded-xl border p-4 text-center"
          >
            <span className="flex h-20 w-20 items-end justify-center overflow-hidden">
              <PetPreview
                sheetUrl={member.sheetUrl}
                label={`${member.name}, animated`}
                size={64}
                deferLoading
              />
            </span>
            <span className="text-foreground text-sm font-medium">{member.name}</span>
            <span className="text-muted-foreground text-xs">{member.tagline}</span>
          </li>
        ))}
      </ul>
    </DiscoverBand>
  );
}
