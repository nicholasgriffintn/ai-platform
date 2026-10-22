import { ButtonLink } from "@ngriffin_uk/polychat-component-ui";
import { parseSourcesPath, type SourcesView } from "@ngriffin_uk/polychat-library-react";
import { lazy, Suspense } from "react";

import { SourcesLibrary } from "../SourcesLibrary.js";
import { SourceDetail } from "./SourceDetail.js";

const PodcastStudio = lazy(async () => ({
  default: (await import("./PodcastStudio.js")).PodcastStudio,
}));
const ImageStudio = lazy(async () => ({
  default: (await import("../Studio/ImageStudio.js")).ImageStudio,
}));
const ReplicateStudio = lazy(async () => ({
  default: (await import("../Studio/Replicate/ReplicateStudio.js")).ReplicateStudio,
}));

const SECTIONS: Array<{ id: SourcesView["view"]; path: string; label: string }> = [
  { id: "library", path: "", label: "Library" },
  { id: "podcasts", path: "podcasts", label: "Podcasts" },
  { id: "studio", path: "studio", label: "Image Studio" },
  { id: "replicate", path: "replicate", label: "Replicate" },
];

export function SourcesSection({
  basePath,
  itemPath,
  projectId,
  createRequestKey,
}: {
  basePath: string;
  itemPath: string;
  projectId?: string;
  createRequestKey?: number;
}) {
  const location = parseSourcesPath(itemPath);

  return (
    <div className="space-y-6">
      {location.view === "source" ? null : (
        <nav aria-label="Sources sections">
          <ul className="flex flex-wrap gap-1">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <ButtonLink
                  href={section.path ? `${basePath}/${section.path}` : basePath}
                  variant={section.id === location.view ? "secondary" : "ghost"}
                  size="sm"
                  aria-current={section.id === location.view ? "page" : undefined}
                >
                  {section.label}
                </ButtonLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <Suspense fallback={null}>
        {location.view === "library" ? (
          <SourcesLibrary
            key={projectId ?? "personal"}
            basePath={basePath}
            projectId={projectId}
            createRequestKey={createRequestKey}
          />
        ) : location.view === "podcasts" ? (
          <PodcastStudio basePath={basePath} projectId={projectId} />
        ) : location.view === "studio" ? (
          <ImageStudio projectId={projectId} />
        ) : location.view === "replicate" ? (
          <ReplicateStudio
            basePath={`${basePath}/replicate`}
            subpath={location.subpath}
            projectId={projectId}
          />
        ) : (
          <SourceDetail sourceId={location.sourceId} backHref={basePath} />
        )}
      </Suspense>
    </div>
  );
}
