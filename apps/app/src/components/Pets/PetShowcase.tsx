import { ButtonLink } from "@ngriffin_uk/polychat-component-ui";

import { PetPreview } from "~/components/Core/PetPreview";
import { type PetLoreEntry, PET_FLOCK, PET_STRAYS } from "~/lib/pet/lore";

function TraitList({ traits }: { traits: PetLoreEntry["traits"] }) {
  return (
    <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
      {traits.map((trait) => (
        <div key={trait.label}>
          <dt className="text-xs tracking-wide text-zinc-500 uppercase dark:text-zinc-500">
            {trait.label}
          </dt>
          <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">{trait.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Perch({ entry, size }: { entry: PetLoreEntry; size: number }) {
  return (
    <div className="flex items-end justify-center rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
      <PetPreview sheetUrl={entry.sheetUrl} label={`${entry.name}, animated`} size={size} />
    </div>
  );
}

export function PetShowcase() {
  return (
    <div className="space-y-16 pb-16">
      <header className="space-y-4">
        <h1 className="text-3xl font-bold text-zinc-900 md:text-5xl dark:text-zinc-50">
          Polychat Pets
        </h1>
        <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
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
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {PET_FLOCK.title}
          </h2>
          <p className="text-zinc-600 italic dark:text-zinc-400">{PET_FLOCK.standfirst}</p>
          {PET_FLOCK.lore.map((paragraph) => (
            <p key={paragraph} className="text-zinc-600 dark:text-zinc-400">
              {paragraph}
            </p>
          ))}
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {PET_FLOCK.members.map((member) => (
            <li
              key={member.slug}
              className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-5 sm:flex-row sm:items-start dark:border-zinc-800"
            >
              <div className="flex shrink-0 items-end justify-center rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/60">
                <PetPreview
                  sheetUrl={member.sheetUrl}
                  label={`${member.name}, animated`}
                  size={72}
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {member.name}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-500">{member.tagline}</p>
                {member.lore.map((paragraph) => (
                  <p key={paragraph} className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
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
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">The strays</h2>
        <p className="max-w-2xl text-zinc-600 dark:text-zinc-400">
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
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {stray.name}
            </h2>
            <p className="mt-1 text-zinc-500 italic dark:text-zinc-500">{stray.tagline}</p>
            {stray.lore.map((paragraph) => (
              <p key={paragraph} className="mt-4 text-zinc-600 dark:text-zinc-400">
                {paragraph}
              </p>
            ))}
            <TraitList traits={stray.traits} />
          </div>
        </section>
      ))}

      <footer className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <p className="max-w-2xl text-zinc-600 dark:text-zinc-400">
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
