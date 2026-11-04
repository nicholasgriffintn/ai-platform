import { isRecord, readArray, readNonEmptyString } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { TitleRef } from "~/modules/watching/domain/titles";

const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
const WIKIDATA_TIMEOUT_MS = 20_000;
const TMDB_PROPERTIES = { movie: "P4947", tv: "P4983" } as const;
const FACT_KINDS = ["basedOn", "filmingLocation", "award"] as const;

type FactKind = (typeof FACT_KINDS)[number];

export type TitleBackground = Record<FactKind, string[]>;

function backgroundQuery(ref: TitleRef): string {
  return `SELECT ?kind ?valueLabel WHERE {
  ?item wdt:${TMDB_PROPERTIES[ref.mediaType]} "${ref.tmdbId}".
  { ?item wdt:P144 ?value. BIND("basedOn" AS ?kind) }
  UNION { ?item wdt:P915 ?value. BIND("filmingLocation" AS ?kind) }
  UNION { ?item wdt:P166 ?value. BIND("award" AS ?kind) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 80`;
}

function isFactKind(value: string | undefined): value is FactKind {
  return FACT_KINDS.some((kind) => kind === value);
}

function readBinding(binding: Record<string, unknown>, key: string): string | undefined {
  const field = binding[key];

  return isRecord(field) ? readNonEmptyString(field.value) : undefined;
}

export async function fetchTitleBackground(ref: TitleRef): Promise<TitleBackground> {
  const url = new URL(WIKIDATA_SPARQL_URL);

  url.search = new URLSearchParams({ query: backgroundQuery(ref), format: "json" }).toString();

  const response = await fetch(url, {
    headers: { Accept: "application/sparql-results+json", "User-Agent": "Polychat/1.0" },
    signal: AbortSignal.timeout(WIKIDATA_TIMEOUT_MS),
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new AssistantError(
      `Wikidata answered with ${response.status}`,
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const payload: unknown = await response.json();
  const results = isRecord(payload) && isRecord(payload.results) ? payload.results : {};
  const background: TitleBackground = { basedOn: [], filmingLocation: [], award: [] };

  for (const binding of readArray(results.bindings)) {
    const kind = isRecord(binding) ? readBinding(binding, "kind") : undefined;
    const value = isRecord(binding) ? readBinding(binding, "valueLabel") : undefined;

    if (isFactKind(kind) && value) {
      background[kind].push(value);
    }
  }

  return background;
}
