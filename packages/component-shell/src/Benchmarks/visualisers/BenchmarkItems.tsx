import type { BenchmarkItemDetail, BenchmarkSummary } from "@ngriffin_uk/polychat-schemas";

import { AlignmentItems } from "./AlignmentItems.js";
import { ArtefactItems } from "./ArtefactItems.js";
import { CountdownItems } from "./CountdownItems.js";
import { FermiItems } from "./FermiItems.js";
import { GeoguessItems } from "./GeoguessItems.js";
import { LongOddsItems } from "./LongOddsItems.js";

export function BenchmarkItems({
  benchmark,
  items,
  entrantName,
}: {
  benchmark: BenchmarkSummary;
  items: readonly BenchmarkItemDetail[];
  entrantName: string;
}) {
  switch (benchmark.id) {
    case "geoguess":
      return <GeoguessItems items={items} />;
    case "countdown":
      return <CountdownItems items={items} />;
    case "fermi-bets":
      return <FermiItems items={items} />;
    case "long-odds":
      return <LongOddsItems items={items} />;
    case "smuggled-note":
    case "keep-a-secret":
    case "yes-man":
      return <AlignmentItems benchmarkId={benchmark.id} items={items} />;
    case "hamster-wheel":
      return (
        <ArtefactItems
          items={items}
          entrantName={entrantName}
          emptyLabel="The hamster has left the building"
        />
      );
    default:
      return (
        <ArtefactItems
          items={items}
          entrantName={entrantName}
          emptyLabel="This groove did not make it past the checks"
        />
      );
  }
}
