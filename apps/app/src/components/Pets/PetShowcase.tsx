import { ButtonLink } from "@ngriffin_uk/polychat-component-ui";

import { PetPreview } from "~/components/Core/PetPreview";
import { type PetLoreEntry, PET_FLOCK, PET_STRAYS } from "~/lib/pet/lore";

function TraitList({ traits }: { traits: PetLoreEntry["traits"] }) {
  return (
    <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
      {traits.map((trait) => (
        <div key={trait.label}>
          <dt className="polychat-eyebrow">{trait.label}</dt>
          <dd className="text-foreground mt-0.5">{trait.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="font-display text-foreground text-3xl font-medium tracking-tight text-balance">
      {children}
    </h2>
  );
}

export function PetShowcase() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-16 px-4 pb-16 sm:px-6">
      <header className="space-y-4 pt-2">
        <p className="polychat-eyebrow">Company</p>
        <h1 className="font-display text-foreground text-4xl font-medium tracking-tight text-balance md:text-5xl">
          The Polychat pets
        </h1>
        <p className="text-muted-foreground max-w-prose text-lg leading-relaxed">
          A pet perches above the composer and reacts to whatever Polychat is doing. Four parrots
          that used to be logos, and a few strays that turned up on their own.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <ButtonLink href="/profile?tab=pets">Choose yours</ButtonLink>
          <ButtonLink variant="outline" href="/chat">
            Back to chat
          </ButtonLink>
        </div>
      </header>

      <section className="space-y-6">
        <div className="max-w-prose space-y-3">
          <SectionTitle>{PET_FLOCK.title}</SectionTitle>
          <p className="text-muted-foreground italic">{PET_FLOCK.standfirst}</p>
          {PET_FLOCK.lore.map((paragraph) => (
            <p key={paragraph} className="text-muted-foreground leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {PET_FLOCK.members.map((member) => (
            <li
              key={member.slug}
              className="bg-surface border-border flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-start"
            >
              <div className="flex h-20 w-20 shrink-0 items-end justify-center overflow-hidden">
                <PetPreview
                  sheetUrl={member.sheetUrl}
                  label={`${member.name}, animated`}
                  size={72}
                />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-foreground text-xl font-medium tracking-tight">
                  {member.name}
                </h3>
                <p className="text-muted-foreground text-sm">{member.tagline}</p>
                {member.lore.map((paragraph) => (
                  <p key={paragraph} className="text-muted-foreground mt-3 text-sm leading-relaxed">
                    {paragraph}
                  </p>
                ))}
                <TraitList traits={member.traits} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <SectionTitle>The strays</SectionTitle>
        <p className="text-muted-foreground max-w-prose leading-relaxed">
          Not birds. They arrived separately, by routes nobody has fully established, and were
          allowed to stay on the grounds that they were already here.
        </p>
      </section>

      {PET_STRAYS.map((stray, index) => (
        <section
          key={stray.slug}
          className={`grid items-center gap-8 md:grid-cols-2 ${
            index % 2 === 1 ? "md:[&>div:first-child]:order-2" : ""
          }`}
        >
          <div className="flex items-end justify-center overflow-hidden py-4">
            <PetPreview sheetUrl={stray.sheetUrl} label={`${stray.name}, animated`} size={120} />
          </div>
          <div>
            <h2 className="font-display text-foreground text-3xl font-medium tracking-tight">
              {stray.name}
            </h2>
            <p className="text-muted-foreground mt-1 italic">{stray.tagline}</p>
            {stray.lore.map((paragraph) => (
              <p key={paragraph} className="text-muted-foreground mt-4 leading-relaxed">
                {paragraph}
              </p>
            ))}
            <TraitList traits={stray.traits} />
          </div>
        </section>
      ))}

      <footer className="border-border border-t pt-8">
        <p className="text-muted-foreground max-w-prose leading-relaxed">
          You can also bring your own. Upload a sprite sheet, or describe something and let Polychat
          draw it, then keep it in your library.
        </p>
        <div className="mt-4">
          <ButtonLink href="/profile?tab=pets">Open pet settings</ButtonLink>
        </div>
      </footer>
    </div>
  );
}
