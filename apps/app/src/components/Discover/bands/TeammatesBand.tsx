import { getIcon } from "@ngriffin_uk/polychat-component-capabilities";
import { ButtonLink, Skeleton } from "@ngriffin_uk/polychat-component-ui";

import { usePublicCapabilityCatalogue } from "~/hooks/useCapabilityCatalog";

import { DiscoverBand } from "../DiscoverBand";

const APP_LIMIT = 6;

export function TeammatesBand() {
  const { data, isLoading } = usePublicCapabilityCatalogue();
  const apps = (data?.experiences ?? []).slice(0, APP_LIMIT);
  const toolCount = (data?.modelTools.length ?? 0) + (data?.tools.length ?? 0);
  const automationCount = data?.recipes.length ?? 0;
  const lede = data
    ? `Apps for research, writing, media and code, ${toolCount} tools a model can call, and ${automationCount} automation templates that run on a schedule or an event. Teammates, skills and the automations you install are yours to curate.`
    : "Apps for research, writing, media and code, tools a model can call, and automation templates that run on a schedule or an event. Teammates, skills and the automations you install are yours to curate.";

  return (
    <DiscoverBand
      id="teammates"
      eyebrow="Beyond the reply"
      title="Teammates, apps and automations"
      lede={lede}
      actions={
        <ButtonLink variant="outline" href="/apps">
          Browse the catalogue
        </ButtonLink>
      }
    >
      <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2">
        {isLoading
          ? Array.from({ length: 4 }, (_, index) => (
              <li key={index}>
                <Skeleton className="h-24 w-full rounded-xl" />
              </li>
            ))
          : apps.map((experience) => (
              <li
                key={experience.id}
                className="bg-surface border-border flex flex-col gap-3 rounded-xl border p-4 lg:flex-row"
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
