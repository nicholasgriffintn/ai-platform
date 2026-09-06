import { resolvePetPreset } from "@ngriffin_uk/polychat-schemas";

export interface PetLoreEntry {
  slug: string;
  name: string;
  sheetUrl: string;
  tagline: string;
  lore: string[];
  traits: { label: string; value: string }[];
}

export interface PetFlockLore {
  title: string;
  standfirst: string;
  lore: string[];
  members: PetLoreEntry[];
}

function entry(
  slug: string,
  tagline: string,
  lore: string[],
  traits: { label: string; value: string }[],
): PetLoreEntry {
  const preset = resolvePetPreset(slug);

  return { slug, name: preset.label, sheetUrl: preset.sheetUrl, tagline, lore, traits };
}

export const PET_FLOCK: PetFlockLore = {
  title: "The flock",
  standfirst: "The original bunch.",
  lore: [
    "Drew by me when I first launched the app, these were the original logos in test.",
    "I didn't have the heart to delete them, so, with the help of AI, i re created them to be animated and react to the application.",
  ],
  members: [
    entry(
      "pip",
      "The house bird.",
      [
        "Pip is Polychat's main logo to this day.",
        "Carries a full crest, a yellow front, and the unshakeable confidence of a default value.",
      ],
      [
        { label: "Temperament", value: "Steady" },
        { label: "Notable", value: "Has never once been redesigned" },
      ],
    ),
    entry(
      "ash",
      "Knows itself",
      [
        "Ash is a more minimalistic variant of Pip, designed like to be a muted grey",
        "Moves less than the others. It is barely moving at all, it doesn't need to.",
      ],
      [
        { label: "Temperament", value: "Reserved" },
        { label: "Notable", value: "Smallest eye, widest silence" },
      ],
    ),
    entry(
      "kea",
      "No volume control.",
      [
        "As a tropical blue, Kea is a more eager variant of the bunch.",
        "Every animation is a third larger than everyone else's. This is not a bug in the rig, it is simply what Kea is like.",
      ],
      [
        { label: "Temperament", value: "Loud" },
        { label: "Notable", value: "Red crest, gold beak, no restraint" },
      ],
    ),
    entry(
      "prism",
      "Abstract, not confused.",
      [
        "Prism is more geometric and stylized with a small cross to show it means business.",
        "Tilts instead of bobbing, on the grounds that bobbing is for birds who have not thought about it.",
      ],
      [
        { label: "Temperament", value: "Rigid" },
        { label: "Notable", value: "Will not discuss the cross" },
      ],
    ),
  ],
};

export const PET_STRAYS: PetLoreEntry[] = [
  entry(
    "bit",
    "Still running something.",
    [
      "Nobody really knows what Bit does, but the consensus seems to be that turning it off would be a problem.",
      "Holds firm views about monospace fonts and tabs vs spaces, will share them.",
    ],
    [
      { label: "Temperament", value: "Rigid, tilts" },
      { label: "Notable", value: "Has an opinion about your terminal" },
    ],
  ),
  entry(
    "sprocket",
    "One more gear should do it.",
    [
      "Was found in a drawer, appears to have been removed from a machine that still works somehow...",
      "Believes most problems are a transmission issue. Has proposed adding a gear to the login flow on three separate occasions.",
    ],
    [
      { label: "Temperament", value: "Mechanical" },
      { label: "Notable", value: "One lens, total conviction" },
    ],
  ),
  entry(
    "flask",
    "Nobody labelled it.",
    [
      "The label came off a long time ago and nobody has read the safety sheet",
      "Bobs when it is excited, which is most of the time, and fizzes gently when it is not.",
    ],
    [
      { label: "Temperament", value: "Effervescent" },
      { label: "Notable", value: "Contents: unconfirmed" },
    ],
  ),
  entry(
    "moss",
    "Was here first.",
    [
      "Predates the application, the sprout seems to be a recent development, Moss has yet to comment on it.",
      "Moves about half as much as anything else here. This is not laziness. It is a rock, and it is pacing itself.",
    ],
    [
      { label: "Temperament", value: "Geological" },
      { label: "Notable", value: "Outlasts every roadmap" },
    ],
  ),
];
