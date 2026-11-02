import type { DiscoverDayProfile, DiscoverPlace } from "@ngriffin_uk/polychat-schemas";

import { ConnectorPlaceField } from "../../../Connectors/ConnectorPlaceField.js";

export function DiscoverPlacesField({
  profile,
  onChange,
  origin,
  destination,
  onOrigin,
  onDestination,
}: {
  profile: DiscoverDayProfile;
  onChange: (profile: DiscoverDayProfile) => void;
  origin: DiscoverPlace | null;
  destination: DiscoverPlace | null;
  onOrigin: (place: DiscoverPlace | null) => void;
  onDestination: (place: DiscoverPlace | null) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="sr-only">Weather and travel</legend>
      <ConnectorPlaceField
        label="Weather place"
        provider="openweather_api"
        value={profile.weatherLocation}
        onChange={(weatherLocation) => onChange({ ...profile, weatherLocation })}
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Travel uses TfL for London public transport. Choose your usual stations or stops; Poly
        checks journeys and disruptions near your departure times on office days.
      </p>
      <ConnectorPlaceField label="From home" provider="tfl" value={origin} onChange={onOrigin} />
      <ConnectorPlaceField
        label="To work"
        provider="tfl"
        value={destination}
        onChange={onDestination}
      />
    </fieldset>
  );
}
