export interface Pile {
  id: string;
  label: string;
  description: string;
}

export interface PilePreset {
  name: string;
  piles: readonly Omit<Pile, "id">[];
}

export const MIN_PILES = 2;
export const MAX_PILES = 12;

export const PILE_PRESETS: readonly PilePreset[] = [
  {
    name: "Camera roll tidy",
    piles: [
      { label: "People", description: "Photos where people are the subject" },
      { label: "Pets and animals", description: "Animals are the subject" },
      { label: "Food and drink", description: "Meals, dishes, drinks" },
      { label: "Places", description: "Landscapes, cities, buildings, travel" },
      { label: "Documents", description: "Receipts, letters, forms, whiteboards, notes" },
      { label: "Screenshots", description: "Screen captures of apps, sites or messages" },
    ],
  },
  {
    name: "Listing photos",
    piles: [
      { label: "Exterior", description: "Outside of a building or garden" },
      { label: "Living spaces", description: "Living rooms, dining rooms, hallways" },
      { label: "Kitchen", description: "Kitchens and utility rooms" },
      { label: "Bedrooms", description: "Bedrooms and dressing rooms" },
      { label: "Bathrooms", description: "Bathrooms, showers, toilets" },
    ],
  },
  {
    name: "Mood board",
    piles: [
      { label: "Calm", description: "Quiet, soft, restful" },
      { label: "Bold", description: "Strong colour, contrast, energy" },
      { label: "Nostalgic", description: "Retro, faded, sentimental" },
      { label: "Playful", description: "Silly, whimsical, fun" },
    ],
  },
];

export const FLAGS = {
  face: "Shows a person's face",
  text: "Contains readable text",
  blurry: "Blurry, dark or badly exposed",
  screenshot: "Is a screenshot rather than a photograph",
} as const;
export type PhotoFlag = keyof typeof FLAGS;

export const KEEPER_LEVELS = ["Bin it", "Meh", "Keep", "Frame it"];

export const createPiles = (preset: PilePreset): Pile[] =>
  preset.piles.map((pile, index) => ({ ...pile, id: `p${index}` }));
