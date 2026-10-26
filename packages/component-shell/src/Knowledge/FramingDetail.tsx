import { ARTICLE_SLANT_LABELS, type SourceFraming } from "@ngriffin_uk/polychat-schemas";

import { AnalysisList, AnalysisSection, AnalysisTags } from "./Analysis.js";

export function FramingDetail({ framing }: { framing: SourceFraming }) {
  return (
    <div className="flex flex-col gap-2.5">
      <AnalysisTags
        tags={[
          ARTICLE_SLANT_LABELS[framing.slant],
          framing.tone,
          ...(framing.grade ? [`Writing grade ${framing.grade}`] : []),
        ]}
      />
      <p className="text-[0.8125rem] leading-relaxed text-foreground">{framing.overview}</p>
      <AnalysisList heading="Sourcing" items={[framing.sourcing]} />
      {framing.loadedLanguage.length > 0 && (
        <AnalysisSection heading="Loaded language" count={framing.loadedLanguage.length}>
          <ul className="flex flex-col gap-2">
            {framing.loadedLanguage.map((item) => (
              <li key={item.quote} className="flex flex-col gap-0.5">
                <q className="italic">{item.quote}</q>
                <span className="text-xs text-muted-foreground">{item.note}</span>
              </li>
            ))}
          </ul>
        </AnalysisSection>
      )}
      <AnalysisList heading="Left out" items={framing.missingPerspectives} />
    </div>
  );
}
