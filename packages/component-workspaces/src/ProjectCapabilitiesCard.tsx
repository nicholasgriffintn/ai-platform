import { Card } from "@ngriffin_uk/polychat-component-ui";
import type { ProjectCapability } from "@ngriffin_uk/polychat-schemas";
import { Settings2 } from "lucide-react";

const MAX_VISIBLE_CAPABILITIES = 6;

interface ProjectCapabilitiesCardProps {
  capabilities: ProjectCapability[];
  capabilityCount: number;
  embedded?: boolean;
}

export function ProjectCapabilitiesCard({
  capabilities,
  capabilityCount,
  embedded = false,
}: ProjectCapabilitiesCardProps) {
  const visibleCapabilities = capabilities.slice(0, MAX_VISIBLE_CAPABILITIES);
  const hiddenCapabilityCount = Math.max(0, capabilities.length - visibleCapabilities.length);

  const content = (
    <>
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-creative/12 p-2 text-creative">
          <Settings2 size={17} />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Project capabilities</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Apps, recipes, and tools available to this project.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-11">
        <p className="mr-1 shrink-0 text-sm text-muted-foreground">{capabilityCount} enabled</p>
        {visibleCapabilities.length > 0 && (
          <>
            {visibleCapabilities.map((capability) => (
              <span
                key={capability.id}
                title={capability.capabilityId}
                className="max-w-full truncate rounded-full border border-border px-2.5 py-1 text-xs"
              >
                {capability.capabilityId}
              </span>
            ))}
            {hiddenCapabilityCount > 0 && (
              <span className="rounded-full bg-surface-elevated px-2.5 py-1 text-xs text-muted-foreground">
                +{hiddenCapabilityCount} more
              </span>
            )}
          </>
        )}
      </div>
    </>
  );

  return embedded ? (
    <section className="space-y-4 border-t border-border p-5">{content}</section>
  ) : (
    <Card className="gap-4 p-5 shadow-none">{content}</Card>
  );
}
