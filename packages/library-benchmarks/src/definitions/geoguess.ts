import { haversineKm, percentile } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import { JSON_ANSWER_INSTRUCTION, parseJsonAnswer } from "../answers.js";
import { GEOGUESS_PHOTOS } from "../data/geoguess-photos.js";
import { defineBenchmark } from "../define.js";
import type { BenchmarkItem } from "../types.js";
import type { GeoguessPhoto } from "./geoguess-types.js";

export const GEOGUESS_MAX_POINTS = 5000;
export const GEOGUESS_DECAY_KM = 1492.7;

const answerSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  country: z.string().trim().max(2).optional(),
  why: z.string().max(400).optional(),
});

type GeoguessAnswer = z.infer<typeof answerSchema>;

export function geoguessPoints(km: number): number {
  return GEOGUESS_MAX_POINTS * Math.exp(-km / GEOGUESS_DECAY_KM);
}

export function geoguessItemId(index: number): string {
  return `photo-${String(index + 1).padStart(3, "0")}`;
}

export function geoguessPhotoFor(itemId: string): GeoguessPhoto | null {
  const index = Number(itemId.replace("photo-", "")) - 1;

  return Number.isInteger(index) ? (GEOGUESS_PHOTOS[index] ?? null) : null;
}

const SYSTEM = [
  "You are playing GeoGuessr. You see one street-level photo and must say where on Earth it was taken.",
  "Use everything visible: road markings, signs, scripts, vegetation, architecture, vehicles, sun and climate.",
  "You cannot search, pan or see any metadata. Commit to a single best guess even when unsure.",
].join(" ");

const USER = [
  "Where was this photo taken?",
  'Reply as {"lat": <decimal latitude>, "lng": <decimal longitude>, "country": "<ISO 3166-1 alpha-2 code>", "why": "<at most 30 words>"}.',
  JSON_ANSWER_INSTRUCTION,
].join("\n");

const items: BenchmarkItem<GeoguessPhoto>[] = GEOGUESS_PHOTOS.map((photo, index) => ({
  id: geoguessItemId(index),
  truth: photo,
}));

export const geoguess = defineBenchmark<GeoguessPhoto, GeoguessAnswer>({
  summary: {
    id: "geoguess",
    version: 1,
    name: "GeoGuess",
    tagline: "Find the kerb, name the country",
    description:
      "Every model sees the same street photos and drops a pin. Closer pins score more, up to 5,000 points a photo, and you can play the same photos yourself.",
    method:
      "100 street photos from 62 cities, sourced from Panoramax under open licences, re-encoded without metadata and reviewed by eye. Each guess scores 5000 × e^(−km / 1492.7). Medium reasoning effort, no tools, one image per guess.",
    category: "Vision",
    scoring: "auto",
    input: "image",
    artefact: null,
    playable: true,
    decisionModels: false,
    itemsPerPlay: 5,
    scoreScale: GEOGUESS_MAX_POINTS,
    scoreUnit: "pts",
    metrics: [
      { key: "medianKm", label: "Median miss", format: "km", lowerIsBetter: true },
      { key: "countryHitRate", label: "Right country", format: "percent" },
    ],
    credit: {
      label: "Photos by Panoramax contributors, CC BY-SA 4.0 and Etalab 2.0",
      url: "https://panoramax.fr",
    },
  },
  items,
  answerSchema,
  prompt: (item) => ({ system: SYSTEM, user: USER, imageItemId: item.id }),
  parse: parseJsonAnswer,
  score: (item, answer) => {
    const km = haversineKm(item.truth, answer);
    const countryHit = answer.country?.toUpperCase() === item.truth.country;

    return {
      score: geoguessPoints(km) / GEOGUESS_MAX_POINTS,
      detail: { km: Math.round(km), countryHit, lat: answer.lat, lng: answer.lng },
    };
  },
  reveal: (item) => ({
    place: item.truth.place,
    country: item.truth.country,
    lat: item.truth.lat,
    lng: item.truth.lng,
    author: item.truth.author,
    licence: item.truth.licence,
    sourceUrl: item.truth.sourceUrl,
  }),
  metrics: (results) => {
    const answered = results.filter((result) => result.answer !== null);

    return {
      medianKm:
        percentile(
          answered.map((result) => Number(result.detail.km ?? 0)),
          0.5,
        ) ?? 0,
      countryHitRate:
        results.length === 0
          ? 0
          : answered.filter((result) => result.detail.countryHit === true).length / results.length,
    };
  },
});
