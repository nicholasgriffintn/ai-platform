import { useMemo } from "react";

import { SectionNav } from "~/components/Core/SectionNav";
import { ModelLineup } from "~/components/Models/ModelLineup";
import { MODELS_SECTION_NAV } from "~/components/Models/models-sections";
import { ProviderCatalogue } from "~/components/Models/ProviderCatalogue";
import { useModelCatalogue } from "~/hooks/useModels";
import { groupModelsByProvider, isCatalogueModel } from "~/lib/model-catalogue";

export function ModelsCatalogue() {
  const { data, isLoading, error } = useModelCatalogue();
  const models = useMemo(() => Object.values(data ?? {}).filter(isCatalogueModel), [data]);
  const groups = useMemo(() => groupModelsByProvider(models), [models]);
  const lede =
    models.length > 0
      ? `${models.length} models from ${groups.length} providers, reached through Polychat or your own keys. Pick a tier per message and the first model your plan can run wins, or name a particular bird when you want one.`
      : "Every model Polychat can reach, through Polychat or your own keys. Pick a tier per message and the first model your plan can run wins, or name a particular bird when you want one.";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
      <header className="space-y-5 pt-2 pb-12">
        <p className="polychat-eyebrow">Models</p>
        <h1 className="font-display text-foreground text-4xl font-medium tracking-tight text-balance md:text-5xl">
          Every model, one perch
        </h1>
        <p className="text-muted-foreground max-w-prose text-lg leading-relaxed">{lede}</p>
        <SectionNav label="Models sections" sections={MODELS_SECTION_NAV} />
      </header>
      <ModelLineup />
      <ProviderCatalogue
        groups={groups}
        modelCount={models.length}
        isLoading={isLoading}
        hasError={Boolean(error)}
      />
    </div>
  );
}
