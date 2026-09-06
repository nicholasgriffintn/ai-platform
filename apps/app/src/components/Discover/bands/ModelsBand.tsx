import { ProviderGlyph } from "@ngriffin_uk/polychat-component-models";
import { ButtonLink, Skeleton } from "@ngriffin_uk/polychat-component-ui";
import { useModelCatalogue, summariseModelProviders } from "@ngriffin_uk/polychat-library-react";
import { useMemo } from "react";

import { DiscoverBand } from "../DiscoverBand";

const PROVIDER_LIMIT = 12;
const FEATURED_LIMIT = 6;

export function ModelsBand() {
  const { data, isLoading } = useModelCatalogue();
  const models = useMemo(() => Object.values(data ?? {}), [data]);
  const providers = useMemo(() => summariseModelProviders(models), [models]);
  const featured = useMemo(
    () => models.filter((model) => model.isFeatured && model.name).slice(0, FEATURED_LIMIT),
    [models],
  );
  const lede =
    isLoading || models.length === 0
      ? "Every frontier model in one picker, chosen per message or by tier. Bring your own keys and the usage is yours."
      : `${models.length} models from ${providers.length} providers in one picker, chosen per message or by tier. Bring your own keys and the usage is yours.`;

  return (
    <DiscoverBand
      id="models"
      eyebrow="The catalogue"
      title="Every model, one perch"
      lede={lede}
      actions={
        <ButtonLink variant="outline" href="/models">
          Browse the catalogue
        </ButtonLink>
      }
    >
      <div className="space-y-5">
        <ul aria-label="Providers" className="flex flex-wrap gap-2">
          {isLoading
            ? Array.from({ length: 8 }, (_, index) => (
                <li key={index}>
                  <Skeleton className="h-11 w-11 rounded-lg" />
                </li>
              ))
            : providers.slice(0, PROVIDER_LIMIT).map((provider) => (
                <li
                  key={provider.id}
                  title={`${provider.id}: ${provider.modelCount} models`}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface text-foreground"
                >
                  <ProviderGlyph
                    name={provider.id}
                    size={20}
                    fallback={
                      <span aria-hidden className="font-mono text-sm font-semibold uppercase">
                        {provider.id.charAt(0)}
                      </span>
                    }
                  />
                  <span className="sr-only">
                    {provider.id}, {provider.modelCount} models
                  </span>
                </li>
              ))}
        </ul>
        {featured.length > 0 && (
          <ul aria-label="Featured models" className="flex flex-wrap gap-2">
            {featured.map((model) => (
              <li
                key={model.matchingModel}
                className="rounded-md bg-surface-elevated px-2.5 py-1 font-mono text-xs text-foreground"
              >
                {model.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </DiscoverBand>
  );
}
