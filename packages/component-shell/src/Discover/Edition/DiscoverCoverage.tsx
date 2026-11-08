import { buttonClassName, WorkbenchCard } from "@ngriffin_uk/polychat-component-ui";
import { getStoryPath, useStory } from "@ngriffin_uk/polychat-library-react";
import type { StoryPage } from "@ngriffin_uk/polychat-schemas";
import { formatCount } from "@ngriffin_uk/polychat-utility-core";
import { Newspaper } from "lucide-react";
import { Link } from "react-router";

import { AnalysisList, AnalysisSection, AnalysisTags } from "../../Knowledge/Analysis.js";

function CoverageDetail({ page }: { page: StoryPage }) {
  const { story, version } = page;

  if (!version) {
    return <p>Poly is still gathering coverage of this story.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      <AnalysisTags tags={[formatCount(story.outletCount, "outlet")]} />
      <AnalysisList heading="Overview" items={version.overview} />
      <AnalysisList heading="What they agree on" items={version.agreed} />
      {version.outlets.length > 0 && (
        <AnalysisSection heading="Each outlet's angle" count={version.outlets.length}>
          <ul className="flex flex-col gap-1.5">
            {version.outlets.map((outlet) => (
              <li key={outlet.source}>
                <span className="font-medium">{outlet.source}:</span> {outlet.angle}
              </li>
            ))}
          </ul>
        </AnalysisSection>
      )}
      <AnalysisList heading="Where they differ" items={version.disputed} />
      <AnalysisList heading="What's missing" items={version.gaps} />
    </div>
  );
}

export function DiscoverCoverageCard({ storyId }: { storyId: string }) {
  const story = useStory(storyId);

  if (story.isError) {
    return null;
  }

  return (
    <WorkbenchCard title="Coverage" icon={Newspaper}>
      <div className="flex flex-col items-start gap-3">
        {story.data ? <CoverageDetail page={story.data} /> : <p>Reading the story.</p>}
        <Link
          to={getStoryPath(storyId)}
          className={buttonClassName({ variant: "outline", size: "xs" })}
        >
          Full story
        </Link>
      </div>
    </WorkbenchCard>
  );
}
