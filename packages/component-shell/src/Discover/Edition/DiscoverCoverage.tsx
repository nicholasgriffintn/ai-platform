import { Button, WorkbenchCard } from "@ngriffin_uk/polychat-component-ui";
import { useDiscoverCoverage, useSource } from "@ngriffin_uk/polychat-library-react";
import {
  DISCOVER_COVERAGE_MIN_ARTICLES,
  readDiscoverCoverage,
  type DiscoverCoverage,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { Newspaper } from "lucide-react";

import {
  DiscoverAnalysisList,
  DiscoverAnalysisSection,
  DiscoverAnalysisTags,
} from "./DiscoverAnalysis.js";

function CoverageDetail({ coverage }: { coverage: DiscoverCoverage }) {
  return (
    <div className="flex flex-col gap-2.5">
      <DiscoverAnalysisTags tags={[`${coverage.sourceIds.length} articles`]} />
      <p className="text-[0.8125rem] leading-relaxed text-foreground">{coverage.overview}</p>
      <DiscoverAnalysisList heading="What they agree on" items={coverage.agreed} />
      {coverage.outlets.length > 0 && (
        <DiscoverAnalysisSection heading="Each outlet's angle" count={coverage.outlets.length}>
          <ul className="flex flex-col gap-1.5">
            {coverage.outlets.map((outlet) => (
              <li key={outlet.source}>
                <span className="font-medium">{outlet.source}:</span> {outlet.angle}
              </li>
            ))}
          </ul>
        </DiscoverAnalysisSection>
      )}
      <DiscoverAnalysisList heading="Where they differ" items={coverage.disputed} />
      <DiscoverAnalysisList heading="What's missing" items={coverage.gaps} />
    </div>
  );
}

function SavedCoverage({ sourceId }: { sourceId: string }) {
  const source = useSource(sourceId).data;
  const coverage = source ? readDiscoverCoverage(source.metadata) : null;

  return coverage ? <CoverageDetail coverage={coverage} /> : <p>Reading the comparison back.</p>;
}

export function DiscoverCoverageCard({
  editionId,
  cardId,
  coverageSourceId,
  articleCount,
}: {
  editionId: string;
  cardId: string;
  coverageSourceId: string | undefined;
  articleCount: number;
}) {
  const compare = useDiscoverCoverage(editionId, cardId);
  const sourceId = coverageSourceId ?? compare.data?.id;

  if (!sourceId && articleCount < DISCOVER_COVERAGE_MIN_ARTICLES) {
    return null;
  }

  return (
    <WorkbenchCard title="Coverage" icon={Newspaper}>
      {sourceId ? (
        <SavedCoverage sourceId={sourceId} />
      ) : (
        <div className="flex flex-col items-start gap-2">
          <p>{articleCount} articles on this today. See where the outlets agree and differ.</p>
          <Button
            variant="outline"
            size="xs"
            isLoading={compare.isPending}
            onClick={() => compare.mutate()}
          >
            Compare the coverage
          </Button>
          {compare.error ? (
            <p className="text-failure">
              {getErrorMessage(compare.error, "Poly couldn't compare the coverage")}
            </p>
          ) : null}
        </div>
      )}
    </WorkbenchCard>
  );
}
