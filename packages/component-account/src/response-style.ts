export type ResponseStyleControlKey = "tone" | "warmth" | "enthusiasm" | "emoji" | "formatting";

export type ResponseStyleOptions = Record<ResponseStyleControlKey, string>;

interface ResponseStyleChoice {
  value: string;
  label: string;
  instruction: string;
}

export interface ResponseStyleControl {
  key: ResponseStyleControlKey;
  label: string;
  field: "traits" | "preferences";
  choices: readonly ResponseStyleChoice[];
}

// Keeps the assistant's usual character when a modifier is chosen without a base tone, because
// any traits text replaces the default traits in the system prompt.
const DEFAULT_TONE_TRAITS = "direct, clear and practical";

function levelChoices(more: string, less: string): ResponseStyleChoice[] {
  return [
    { value: "default", label: "Default", instruction: "" },
    { value: "more", label: "More", instruction: more },
    { value: "less", label: "Less", instruction: less },
  ];
}

export const RESPONSE_STYLE_CONTROLS: readonly ResponseStyleControl[] = [
  {
    key: "tone",
    label: "Base style and tone",
    field: "traits",
    choices: [
      { value: "default", label: "Default", instruction: "" },
      {
        value: "professional",
        label: "Professional",
        instruction: "polished, precise and professional",
      },
      { value: "friendly", label: "Friendly", instruction: "friendly, approachable and chatty" },
      { value: "candid", label: "Candid", instruction: "candid, direct and willing to push back" },
      { value: "quirky", label: "Quirky", instruction: "playful, witty and a little quirky" },
      { value: "efficient", label: "Efficient", instruction: "efficient, brief and to the point" },
      {
        value: "nerdy",
        label: "Nerdy",
        instruction: "nerdy, curious and keen on technical detail",
      },
      {
        value: "cynical",
        label: "Cynical",
        instruction: "dry, sceptical and sardonic while still being helpful",
      },
    ],
  },
  {
    key: "warmth",
    label: "Warmth",
    field: "traits",
    choices: levelChoices("warm and caring", "matter-of-fact rather than warm"),
  },
  {
    key: "enthusiasm",
    label: "Enthusiasm",
    field: "traits",
    choices: levelChoices("enthusiastic and upbeat", "calm and understated"),
  },
  {
    key: "emoji",
    label: "Emoji",
    field: "preferences",
    choices: levelChoices(
      "Use emoji where they add personality.",
      "Do not use emoji unless I ask for them.",
    ),
  },
  {
    key: "formatting",
    label: "Headers and lists",
    field: "preferences",
    choices: levelChoices(
      "Structure longer answers with headers and bulleted lists.",
      "Prefer flowing prose and only use headers or lists when they are essential.",
    ),
  },
];

export const DEFAULT_RESPONSE_STYLE_OPTIONS: ResponseStyleOptions = {
  tone: "default",
  warmth: "default",
  enthusiasm: "default",
  emoji: "default",
  formatting: "default",
};

export function buildResponseStyleInstructions(options: ResponseStyleOptions): {
  traits: string;
  preferences: string;
} {
  const traits: string[] = [];
  const preferences: string[] = [];

  for (const control of RESPONSE_STYLE_CONTROLS) {
    const instruction = control.choices.find(
      (choice) => choice.value === options[control.key],
    )?.instruction;

    if (instruction) {
      (control.field === "traits" ? traits : preferences).push(instruction);
    }
  }

  if (traits.length > 0 && options.tone === "default") {
    traits.unshift(DEFAULT_TONE_TRAITS);
  }

  return {
    traits: traits.join(", "),
    preferences: preferences.map((preference) => `- ${preference}`).join("\n"),
  };
}

let instructionLookup: Map<string, ResponseStyleOptions> | undefined;

function lookupKey(traits: string, preferences: string): string {
  return `${traits.trim()}\n\n${preferences.trim()}`;
}

function getInstructionLookup(): Map<string, ResponseStyleOptions> {
  if (instructionLookup) {
    return instructionLookup;
  }

  let combinations: ResponseStyleOptions[] = [DEFAULT_RESPONSE_STYLE_OPTIONS];

  for (const control of RESPONSE_STYLE_CONTROLS) {
    combinations = combinations.flatMap((options) =>
      control.choices.map((choice) => ({ ...options, [control.key]: choice.value })),
    );
  }

  instructionLookup = new Map();

  for (const options of combinations) {
    const { traits, preferences } = buildResponseStyleInstructions(options);

    instructionLookup.set(lookupKey(traits, preferences), options);
  }

  return instructionLookup;
}

/** Returns the control selections that produce this text, or null when it was written by hand. */
export function matchResponseStyleOptions(
  traits: string | undefined,
  preferences: string | undefined,
): ResponseStyleOptions | null {
  return getInstructionLookup().get(lookupKey(traits ?? "", preferences ?? "")) ?? null;
}
