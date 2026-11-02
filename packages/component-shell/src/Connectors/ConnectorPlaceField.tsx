import { Button, FormInput } from "@ngriffin_uk/polychat-component-ui";
import {
  useConnectorPlaces,
  useRecipeConnector,
  useConnectorSetup,
} from "@ngriffin_uk/polychat-library-react";
import type { Place, RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

import { ConnectorSetupDialogs } from "./ConnectorSetupDialogs.js";

export function ConnectorPlaceField({
  label,
  value,
  provider,
  onChange,
}: {
  label: string;
  value: Place | null;
  provider: RecipeConnectorProvider;
  onChange: (place: Place | null) => void;
}) {
  const [query, setQuery] = useState("");
  const connector = useRecipeConnector(provider);
  const search = useConnectorPlaces(provider, query, connector.data?.status === "connected");
  const setup = useConnectorSetup({ returnTo: "/" });

  return (
    <div className="flex flex-col gap-2">
      {connector.data && connector.data.status !== "connected" ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>{label}</span>
          <Button
            size="xs"
            variant="secondary"
            disabled={setup.isStarting}
            onClick={() => {
              if (connector.data) {
                void setup.connect(connector.data);
              }
            }}
          >
            Connect {connector.data.name}
          </Button>
        </div>
      ) : value ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-selection px-3 py-2 text-sm">
          <span>
            <span className="block text-xs text-muted-foreground">{label}</span>
            {value.label}
          </span>
          <Button size="xs" variant="ghost" onClick={() => onChange(null)}>
            Remove
          </Button>
        </div>
      ) : (
        <FormInput
          label={label}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            provider === "tfl" ? "Find a London station or stop" : "Find your town or city"
          }
          autoComplete="off"
          disabled={connector.data?.status !== "connected"}
        />
      )}
      {!value && connector.data?.status === "connected" && query.trim().length >= 2 ? (
        <div aria-live="polite" className="flex flex-col gap-1">
          {search.isFetching ? (
            <p className="text-xs text-muted-foreground">Finding places…</p>
          ) : null}
          {search.data?.places.map((place) => (
            <button
              key={`${place.latitude}:${place.longitude}:${place.label}`}
              type="button"
              className="rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-selection focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                onChange(place);
                setQuery("");
              }}
            >
              {place.label}
            </button>
          ))}
          {search.data?.places.length === 0 && !search.isFetching ? (
            <p className="text-xs text-muted-foreground">
              No matching places. Try a nearby station or a more specific name.
            </p>
          ) : null}
          {search.error ? (
            <p role="alert" className="text-xs text-failure">
              {getErrorMessage(search.error, "Place search is unavailable")}
            </p>
          ) : null}
        </div>
      ) : null}
      <ConnectorSetupDialogs controller={setup} />
    </div>
  );
}
