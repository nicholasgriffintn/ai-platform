const ROLE_NOUNS = [
  "analyst",
  "brother",
  "daughter",
  "father",
  "husband",
  "mother",
  "sister",
  "son",
  "wife",
  "child",
  "children",
  "citizen",
  "critic",
  "customer",
  "doctor",
  "driver",
  "employee",
  "engineer",
  "expert",
  "family",
  "families",
  "fan",
  "farmer",
  "hacker",
  "investigator",
  "journalist",
  "judge",
  "lawmaker",
  "leader",
  "man",
  "men",
  "migrant",
  "minister",
  "national",
  "nurse",
  "official",
  "parent",
  "passenger",
  "patient",
  "people",
  "police",
  "prosecutor",
  "protester",
  "refugee",
  "reporter",
  "researcher",
  "resident",
  "scientist",
  "senator",
  "soldier",
  "staff",
  "student",
  "survivor",
  "suspect",
  "teacher",
  "troop",
  "user",
  "victim",
  "voter",
  "witness",
  "witnesses",
  "woman",
  "women",
  "worker",
];
const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const EXTRA_PLACES = ["u.s.", "us", "u.k.", "uk", "kremlin", "gaza", "west bank", "europe"];
const ROLE_NOUN_SET = new Set(ROLE_NOUNS);
const MONTH_SET = new Set(MONTH_NAMES);
const REGION_CODE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

let countryNames: Set<string> | null = null;

function readCountryNames(): Set<string> {
  if (countryNames) {
    return countryNames;
  }

  const names = new Set(EXTRA_PLACES);
  const display = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });

  for (const first of REGION_CODE_LETTERS) {
    for (const second of REGION_CODE_LETTERS) {
      const name = display.of(`${first}${second}`);

      if (name) {
        names.add(name.toLowerCase());
      }
    }
  }

  countryNames = names;

  return names;
}

function singular(word: string): string {
  return word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

export function isGenericRoleNoun(name: string): boolean {
  const words = name.toLowerCase().trim().split(/\s+/u).filter(Boolean);
  const last = words.at(-1) ?? "";

  return (
    words.length > 0 &&
    (ROLE_NOUN_SET.has(last) || ROLE_NOUN_SET.has(singular(last)) || MONTH_SET.has(words.join(" ")))
  );
}

export function isCountryName(name: string): boolean {
  return readCountryNames().has(name.toLowerCase().trim());
}
