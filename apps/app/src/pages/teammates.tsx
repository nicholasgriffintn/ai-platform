import { CapabilityLibrary } from "~/components/Capabilities/CapabilityLibrary";
import { usePersonalCapabilityScope } from "~/components/Capabilities/useCapabilityLibraryController";
import { PageShell } from "~/components/Core/PageShell";
import { StandardSidebarContent } from "~/components/Sidebar/StandardSidebarContent";

export function meta() {
  return [{ title: "Teammates & tools - Polychat" }];
}

export default function TeammatesPage() {
  const scope = usePersonalCapabilityScope();

  return (
    <PageShell
      title="Teammates & tools"
      sidebarContent={<StandardSidebarContent />}
      fullBleed
      displayNavBar={false}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div data-header-scroll-source className="min-h-0 flex-1 overflow-y-auto">
          <CapabilityLibrary
            scope={scope}
            title="Teammates &amp; tools"
            subtitle="Teammates, automations, apps and tools that work alongside your conversations."
          />
        </div>
      </div>
    </PageShell>
  );
}
