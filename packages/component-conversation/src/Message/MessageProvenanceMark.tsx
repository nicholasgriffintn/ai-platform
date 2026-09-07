import type { RunProvenance } from "@ngriffin_uk/polychat-schemas";
import { Globe2, Laptop, Monitor } from "lucide-react";

export function MessageProvenanceMark({ provenance }: { provenance?: RunProvenance | null }) {
  if (!provenance || provenance.site === "hosted") {
    return null;
  }

  const details =
    provenance.site === "browser"
      ? "Ran in this browser"
      : provenance.site === "device"
        ? `Ran on ${provenance.machineId || "this device"}`
        : `Ran on ${provenance.machineId || "another machine"}`;
  const Icon =
    provenance.site === "browser" ? Globe2 : provenance.site === "device" ? Laptop : Monitor;

  return (
    <span aria-label={details} className="text-muted-foreground" title={details}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
    </span>
  );
}
