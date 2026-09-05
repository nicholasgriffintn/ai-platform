import { getIcon } from "@ngriffin_uk/polychat-component-capabilities";
import { ButtonLink, Skeleton } from "@ngriffin_uk/polychat-component-ui";

import { useCapabilityCatalog } from "~/hooks/useCapabilityCatalog";

import { DiscoverBand } from "../DiscoverBand";

const EXPERIENCE_LIMIT = 6;

export function CapabilitiesBand() {
  const { data, isLoading } = useCapabilityCatalog();
  const experiences = (data?.experiences ?? []).slice(0, EXPERIENCE_LIMIT);
  const toolCount = data?.modelTools.length ?? 0;
  const agentCount = data?.agents.length ?? 0;
  const lede =
    toolCount > 0
      ? `Experiences for research, writing, media and code, ${toolCount} tools a model can call, and ${agentCount} agents that run on their own. Turn each one on where you want it.`
      : "Experiences for research, writing, media and code, tools a model can call, and agents that run on their own. Turn each one on where you want it.";

  return (
    <DiscoverBand
      id="capabilities"
      eyebrow="Beyond the reply"
      title="Capabilities, not just chat"
      lede={lede}
      actions={
        <ButtonLink variant="outline" href="/chat/capabilities">
          Browse capabilities
        </ButtonLink>
      }
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {isLoading
          ? Array.from({ length: 4 }, (_, index) => (
              <li key={index}>
                <Skeleton className="h-24 w-full rounded-xl" />
              </li>
            ))
          : experiences.map((experience) => (
              <li
                key={experience.id}
                className="bg-surface border-border flex gap-3 rounded-xl border p-4"
              >
                <span className="bg-surface-elevated flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  {getIcon(experience.icon, experience.theme, "h-5 w-5")}
                </span>
                <span className="min-w-0">
                  <span className="text-foreground block text-sm font-medium">
                    {experience.name}
                  </span>
                  <span className="text-muted-foreground mt-1 line-clamp-2 block text-xs leading-relaxed">
                    {experience.description}
                  </span>
                </span>
              </li>
            ))}
      </ul>
    </DiscoverBand>
  );
}
