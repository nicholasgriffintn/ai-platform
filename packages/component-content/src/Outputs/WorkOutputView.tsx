import {
  deckOutputContentSchema,
  DECK_OUTPUT_KIND,
  sheetOutputContentSchema,
  SHEET_OUTPUT_KIND,
} from "@ngriffin_uk/polychat-schemas";

import { DeckView } from "./DeckView";
import { SheetView } from "./SheetView";

export interface WorkOutputViewProps {
  kind: string;
  content: unknown;
  compact?: boolean;
}

export function isWorkOutputKind(kind: string): boolean {
  return kind === DECK_OUTPUT_KIND || kind === SHEET_OUTPUT_KIND;
}

export function WorkOutputView({ kind, content, compact = false }: WorkOutputViewProps) {
  if (kind === DECK_OUTPUT_KIND) {
    const deck = deckOutputContentSchema.safeParse(content);

    return deck.success ? <DeckView content={deck.data} showNotes={!compact} /> : null;
  }

  if (kind === SHEET_OUTPUT_KIND) {
    const sheet = sheetOutputContentSchema.safeParse(content);

    return sheet.success ? (
      <SheetView content={sheet.data} {...(compact ? { maxRows: 12 } : {})} />
    ) : null;
  }

  return null;
}
