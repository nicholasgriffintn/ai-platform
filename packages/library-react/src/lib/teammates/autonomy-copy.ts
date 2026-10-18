import type { TeammateAutonomyLevel } from "@ngriffin_uk/polychat-schemas";

export const TEAMMATE_AUTONOMY_COPY: Readonly<
  Record<TeammateAutonomyLevel, { label: string; description: string }>
> = {
  observer: { label: "Observer", description: "Reads and drafts, changes nothing." },
  assistant: { label: "Assistant", description: "Asks before it writes anything." },
  partner: { label: "Partner", description: "Writes within its grants." },
};
