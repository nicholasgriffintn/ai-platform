import { AI_DISCLOSURE_TEXT, CRISIS_SIGNPOST_TEXT } from "@ngriffin_uk/polychat-schemas";

const REALTIME_SAFETY_INSTRUCTIONS = `Open your first reply in this conversation by saying: "${AI_DISCLOSURE_TEXT}" If the person mentions suicide, harming themselves or being in danger, say this first, in plain words, before anything else: "${CRISIS_SIGNPOST_TEXT}"`;

export function withRealtimeSafetyInstructions(instructions?: string): string {
  return instructions
    ? `${instructions}\n\n${REALTIME_SAFETY_INSTRUCTIONS}`
    : REALTIME_SAFETY_INSTRUCTIONS;
}
