export type ThemeId = "light" | "paper" | "dawn" | "dark" | "blue" | "fern" | "plum";

export type ThemePreference = ThemeId | "system";

export type ThemeAppearance = "light" | "dark";

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  description: string;
  appearance: ThemeAppearance;
  themeColor: string;
}

export interface ThemePreferenceOption {
  value: ThemePreference;
  label: string;
  description: string;
  preview: ThemeId[];
}

export const THEME_STORAGE_KEY = "polychat-theme";

export const LEGACY_THEME_STORAGE_KEY = "theme";

export const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: "light",
    label: "Light",
    description: "Bright surfaces for daylight and shared screens.",
    appearance: "light",
    themeColor: "#f9fafc",
  },
  {
    id: "paper",
    label: "Paper",
    description: "Warm cream and ink, for people who still miss paper.",
    appearance: "light",
    themeColor: "#faf6ee",
  },
  {
    id: "dawn",
    label: "Dawn",
    description: "Cool lavender light. Early, and not yet committed to the day.",
    appearance: "light",
    themeColor: "#f6f6fd",
  },
  {
    id: "dark",
    label: "Dark",
    description: "Near-black blue. The quietest perch after hours.",
    appearance: "dark",
    themeColor: "#040810",
  },
  {
    id: "blue",
    label: "Blue",
    description: "The same cool palette, a few steps off the floor.",
    appearance: "dark",
    themeColor: "#091019",
  },
  {
    id: "fern",
    label: "Fern",
    description: "Deep teal with a mint edge. Undergrowth, after dark.",
    appearance: "dark",
    themeColor: "#05100e",
  },
  {
    id: "plum",
    label: "Plum",
    description: "Aubergine dusk with a rose accent. Feathers ruffled, lights low.",
    appearance: "dark",
    themeColor: "#110710",
  },
];

export const SYSTEM_THEME_OPTION: ThemePreferenceOption = {
  value: "system",
  label: "System",
  description: "Follow the device between light and dark.",
  preview: ["light", "dark"],
};

const THEME_BY_ID = new Map(THEMES.map((theme) => [theme.id, theme]));

const DARK_THEME_IDS = THEMES.filter((theme) => theme.appearance === "dark").map(
  (theme) => theme.id,
);

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_BY_ID.has(value as ThemeId);
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || isThemeId(value);
}

export function getThemeDefinition(id: ThemeId): ThemeDefinition {
  const theme = THEME_BY_ID.get(id);

  if (!theme) {
    throw new Error(`Unknown theme: ${id}`);
  }

  return theme;
}

export function getThemePreferenceOptions(): ThemePreferenceOption[] {
  return [
    SYSTEM_THEME_OPTION,
    ...THEMES.map((theme) => ({
      value: theme.id,
      label: theme.label,
      description: theme.description,
      preview: [theme.id],
    })),
  ];
}

export function resolveThemeId(preference: ThemePreference, prefersDark: boolean): ThemeId {
  return preference === "system" ? (prefersDark ? "dark" : "light") : preference;
}

export function resolveThemeAppearance(
  preference: ThemePreference,
  prefersDark: boolean,
): ThemeAppearance {
  return getThemeDefinition(resolveThemeId(preference, prefersDark)).appearance;
}

export function applyTheme(root: HTMLElement, id: ThemeId): void {
  const theme = getThemeDefinition(id);
  const isDark = theme.appearance === "dark";

  root.dataset.polychatTheme = id;
  root.classList.toggle("dark", isDark);
  root.classList.toggle("light", !isDark);

  root.ownerDocument
    ?.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme.themeColor);
}

export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{
var stored=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||localStorage.getItem(${JSON.stringify(LEGACY_THEME_STORAGE_KEY)});
var ids=${JSON.stringify(THEMES.map((theme) => theme.id))};
var darkIds=${JSON.stringify(DARK_THEME_IDS)};
var themeColors=${JSON.stringify(Object.fromEntries(THEMES.map((theme) => [theme.id, theme.themeColor])))};
var preference=ids.indexOf(stored)>-1?stored:${JSON.stringify(DEFAULT_THEME_PREFERENCE)};
var id=preference==="system"?(window.matchMedia(${JSON.stringify(SYSTEM_DARK_QUERY)}).matches?"dark":"light"):preference;
var isDark=darkIds.indexOf(id)>-1;
var root=document.documentElement;
root.dataset.polychatTheme=id;
root.classList.toggle("dark",isDark);
root.classList.toggle("light",!isDark);
var meta=document.querySelector('meta[name="theme-color"]');
if(meta){meta.setAttribute("content",themeColors[id]);}
}catch(error){}})();`;
