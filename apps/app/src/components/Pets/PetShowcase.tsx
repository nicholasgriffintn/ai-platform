import { ButtonLink } from "@ngriffin_uk/polychat-component-ui";

import { PetPreview } from "~/components/Core/PetPreview";
import { type PetLoreEntry, PET_FLOCK, PET_STRAYS } from "~/lib/pet/lore";

function TraitList({ traits }: { traits: PetLoreEntry["traits"] }) {
  return (
    <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
      {traits.map((trait) => (
        <div key={trait.label}>
          <dt className="text-xs tracking-wide text-muted-foreground uppercase">{trait.label}</dt>
          <dd className="mt-0.5 text-foreground">{trait.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Perch({ entry, size }: { entry: PetLoreEntry; size: number }) {
  return (
    <div className="border-border bg-surface-elevated flex items-end justify-center rounded-xl border p-6">
      <PetPreview sheetUrl={entry.sheetUrl} label={`${entry.name}, animated`} size={size} />
    </div>
  );
}

export function PetShowcase() {
  return (
    <div className="space-y-16 pb-16">
      <header className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground md:text-5xl">Polychat Pets</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Pets are characters that perch or sit above the chat composer wider and react to whatever
          Polychat is doing.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <ButtonLink href="/profile?tab=pets">Choose yours</ButtonLink>
          <ButtonLink variant="outline" href="/chat">
            Back to chat
          </ButtonLink>
        </div>
      </header>

      <section className="space-y-6">
        <div className="max-w-2xl space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">{PET_FLOCK.title}</h2>
          <p className="text-muted-foreground italic">{PET_FLOCK.standfirst}</p>
          {PET_FLOCK.lore.map((paragraph) => (
            <p key={paragraph} className="text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {PET_FLOCK.members.map((member) => (
            <li
              key={member.slug}
              className="flex flex-col gap-4 rounded-xl border border-border p-5 sm:flex-row sm:items-start"
            >
              <div className="bg-surface-elevated flex shrink-0 items-end justify-center rounded-lg p-3">
                <PetPreview
                  sheetUrl={member.sheetUrl}
                  label={`${member.name}, animated`}
                  size={72}
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground">{member.name}</h3>
                <p className="text-sm text-muted-foreground">{member.tagline}</p>
                {member.lore.map((paragraph) => (
                  <p key={paragraph} className="mt-3 text-sm text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
                <TraitList traits={member.traits} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">The strays</h2>
        <p className="max-w-2xl text-muted-foreground">
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
          <Perch entry={stray} size={120} />
          <div>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">{stray.name}</h2>
            <p className="mt-1 text-muted-foreground italic">{stray.tagline}</p>
            {stray.lore.map((paragraph) => (
              <p key={paragraph} className="mt-4 text-muted-foreground">
                {paragraph}
              </p>
            ))}
            <TraitList traits={stray.traits} />
          </div>
        </section>
      ))}

      <footer className="border-t border-border pt-8">
        <p className="max-w-2xl text-muted-foreground">
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
