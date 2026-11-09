import type { StoryVersion } from "@ngriffin_uk/polychat-schemas";

import { StoryBullets } from "./StoryBullets.js";
import { StorySection } from "./StorySection.js";

export function hasStoryAngles(version: StoryVersion): boolean {
  return version.agreed.length > 0 || version.disputed.length > 0 || version.gaps.length > 0;
}

function AngleList({ label, items }: { label: string; items: readonly string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-xs font-medium text-muted-foreground">{label}</h4>
      <StoryBullets items={items} />
    </div>
  );
}

export function StoryAngles({ version }: { version: StoryVersion }) {
  return (
    <StorySection title="Angles">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
        <AngleList label="What they agree on" items={version.agreed} />
        <AngleList label="Where they differ" items={version.disputed} />
        <AngleList label="What's missing" items={version.gaps} />
      </div>
    </StorySection>
  );
}
