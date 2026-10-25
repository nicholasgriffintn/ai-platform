import type { DiscoverWindDownBed, DiscoverWindDownKind } from "@ngriffin_uk/polychat-schemas";

export const WIND_DOWN_KIND_LABELS: Record<
  DiscoverWindDownKind,
  { label: string; detail: string }
> = {
  breathing: { label: "Breathing", detail: "Slow, counted breaths" },
  body_scan: { label: "Body scan", detail: "Attention moves from head to toe" },
  unwind: { label: "Unwind", detail: "Set today down, one thing at a time" },
  story: { label: "Slow story", detail: "Nothing much happens, on purpose" },
  read_back: { label: "Read back", detail: "Your own highlights, read slowly" },
  park: { label: "Park tomorrow", detail: "Say what's on your mind, find it in the morning" },
  sound: { label: "Just the sound", detail: "No voice, only the sound and the scene" },
};

export const WIND_DOWN_BED_LABELS: Record<DiscoverWindDownBed, string> = {
  night: "Night",
  rain: "Rain",
  sea: "Sea",
  embers: "Embers",
  aurora: "Aurora",
};
