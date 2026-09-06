import { PageShell } from "@ngriffin_uk/polychat-component-shell";
import { ButtonLink } from "@ngriffin_uk/polychat-component-ui";
import {
  type FilesTab,
  getFilesTabPath,
  parseFilesSubpath,
} from "@ngriffin_uk/polychat-library-react";
import { Plus } from "lucide-react";
import { type ReactNode, useState } from "react";

import { MemoryLibrary } from "./MemoryLibrary";
import { OutputsLibrary } from "./OutputsLibrary";
import { SourcesLibrary } from "./SourcesLibrary";

const TABS: Array<{ id: FilesTab; label: string; description: string }> = [
  {
    id: "made",
    label: "Made",
    description: "Results that teammates, apps and tools have produced.",
  },
  {
    id: "given",
    label: "Given",
    description: "Files, links, repositories and connected records you have supplied.",
  },
  {
    id: "memory",
    label: "Memory",
    description:
      "What Polychat remembers, kept as documents you can read, edit and delete. Every save is a revision.",
  },
];

export function FilesPage({
  basePath,
  projectId,
  subpath,
  header,
}: {
  basePath: string;
  projectId?: string;
  subpath: string;
  header?: ReactNode;
}) {
  const { tab, itemPath } = parseFilesSubpath(subpath);
  const [createRequestKey, setCreateRequestKey] = useState(0);
  const activeTab = TABS.find((candidate) => candidate.id === tab) ?? TABS[0];

  return (
    <PageShell.Content className="max-w-6xl">
      {header}
      <PageShell.Header
        title="Files"
        actions={
          tab === "given" && !projectId
            ? [
                {
                  label: "Add source",
                  icon: <Plus size={16} />,
                  onClick: () => setCreateRequestKey((current) => current + 1),
                },
              ]
            : undefined
        }
      />
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">{activeTab.description}</p>
      <nav aria-label="Files sections" className="mb-6">
        <ul className="flex flex-wrap gap-1">
          {TABS.map((candidate) => (
            <li key={candidate.id}>
              <ButtonLink
                href={getFilesTabPath(basePath, candidate.id)}
                variant={candidate.id === tab ? "secondary" : "ghost"}
                size="sm"
                aria-current={candidate.id === tab ? "page" : undefined}
              >
                {candidate.label}
              </ButtonLink>
            </li>
          ))}
        </ul>
      </nav>
      {tab === "memory" ? (
        <MemoryLibrary projectId={projectId} />
      ) : tab === "given" ? (
        <SourcesLibrary projectId={projectId} createRequestKey={createRequestKey} />
      ) : (
        <OutputsLibrary
          basePath={getFilesTabPath(basePath, "made")}
          projectId={projectId}
          subpath={itemPath}
        />
      )}
    </PageShell.Content>
  );
}
