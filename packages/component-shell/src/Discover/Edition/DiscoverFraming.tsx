import { Button, WorkbenchCard } from "@ngriffin_uk/polychat-component-ui";
import { useDiscoverFraming, useSource } from "@ngriffin_uk/polychat-library-react";
import {
  ARTICLE_SLANT_LABELS,
  readSourceFraming,
  type SourceFraming,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { Scale } from "lucide-react";

import {
  DiscoverAnalysisList,
  DiscoverAnalysisSection,
  DiscoverAnalysisTags,
} from "./DiscoverAnalysis.js";

function FramingDetail({ framing }: { framing: SourceFraming }) {
  return (
    <div className="flex flex-col gap-2.5">
      <DiscoverAnalysisTags
        tags={[
          ARTICLE_SLANT_LABELS[framing.slant],
          framing.tone,
          ...(framing.grade ? [`Writing grade ${framing.grade}`] : []),
        ]}
      />
      <p className="text-[0.8125rem] leading-relaxed text-foreground">{framing.overview}</p>
      <DiscoverAnalysisList heading="Sourcing" items={[framing.sourcing]} />
      {framing.loadedLanguage.length > 0 && (
        <DiscoverAnalysisSection heading="Loaded language" count={framing.loadedLanguage.length}>
          <ul className="flex flex-col gap-2">
            {framing.loadedLanguage.map((item) => (
              <li key={item.quote} className="flex flex-col gap-0.5">
                <q className="italic">{item.quote}</q>
                <span className="text-xs text-muted-foreground">{item.note}</span>
              </li>
            ))}
          </ul>
        </DiscoverAnalysisSection>
      )}
      <DiscoverAnalysisList heading="Left out" items={framing.missingPerspectives} />
    </div>
  );
}

export function DiscoverFramingCard({
  editionId,
  cardId,
  sourceId,
}: {
  editionId: string;
  cardId: string;
  sourceId: string;
}) {
  const source = useSource(sourceId).data;
  const check = useDiscoverFraming(editionId, cardId);
  const framing = source ? readSourceFraming(source.metadata) : null;

  return (
    <WorkbenchCard title="How it's framed" icon={Scale}>
      {framing ? (
        <FramingDetail framing={framing} />
      ) : (
        <div className="flex flex-col items-start gap-2">
          <p>Slant, tone, sourcing and what the piece leaves out.</p>
          <Button
            variant="outline"
            size="xs"
            isLoading={check.isPending}
            disabled={!source}
            onClick={() => check.mutate()}
          >
            Check the framing
          </Button>
          {check.error ? (
            <p className="text-failure">
              {getErrorMessage(check.error, "Poly couldn't read the framing")}
            </p>
          ) : null}
        </div>
      )}
    </WorkbenchCard>
  );
}
