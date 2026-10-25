import { SquareTerminal, Tv, Watch, type LucideIcon } from "lucide-react";

const CLIENT_ICONS: Record<string, LucideIcon> = {
  "Apple TV": Tv,
  "Apple Watch": Watch,
};

export function deviceIcon(clientName: string): LucideIcon {
  return CLIENT_ICONS[clientName] ?? SquareTerminal;
}
