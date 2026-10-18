import { Loader2 } from "lucide-react";

export function PolyOpening() {
  return (
    <output className="flex flex-1 items-center justify-center">
      <Loader2 size={20} aria-hidden="true" className="animate-spin text-muted-foreground" />
      <span className="sr-only">Opening Poly</span>
    </output>
  );
}
