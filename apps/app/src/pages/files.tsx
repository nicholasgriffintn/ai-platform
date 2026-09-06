import { useParams } from "react-router";

import { PageShell } from "~/components/Core/PageShell";
import { FilesPage } from "~/components/Files/FilesPage";
import { PLACE_PATHS } from "~/lib/navigation/places";

export function meta() {
  return [
    { title: "Files - Polychat" },
    { name: "description", content: "Everything you have given Polychat and everything it made." },
  ];
}

export default function PersonalFilesPage() {
  const { "*": subpath = "" } = useParams();

  return (
    <PageShell title="Files" fullBleed displayNavBar={false}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div data-header-scroll-source className="min-h-0 flex-1 overflow-y-auto">
          <FilesPage basePath={PLACE_PATHS.files} subpath={subpath} />
        </div>
      </div>
    </PageShell>
  );
}
