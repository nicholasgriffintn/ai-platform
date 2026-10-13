import { benchmarkAssetUrl } from "@ngriffin_uk/polychat-library-client";
import type { BenchmarkItemDetail } from "@ngriffin_uk/polychat-schemas";
import { getNumberProperty, getStringProperty } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

import { GeoMap, type GeoMapPair } from "../geo/GeoMap.js";

function toPair(detail: BenchmarkItemDetail, activeId: string | null): GeoMapPair {
  const lat = getNumberProperty(detail.reveal, "lat");
  const lng = getNumberProperty(detail.reveal, "lng");
  const guessLat = getNumberProperty(detail.result?.answer, "lat");
  const guessLng = getNumberProperty(detail.result?.answer, "lng");

  return {
    id: detail.item.id,
    truth: lat !== undefined && lng !== undefined ? { lat, lng } : null,
    guess:
      guessLat !== undefined && guessLng !== undefined ? { lat: guessLat, lng: guessLng } : null,
    label: getStringProperty(detail.reveal, "place") ?? detail.item.id,
    active: activeId === null || activeId === detail.item.id,
  };
}

export function GeoguessItems({ items }: { items: readonly BenchmarkItemDetail[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <GeoMap
        pairs={items.map((detail) => toPair(detail, activeId))}
        ariaLabel="Guesses in amber, true locations in green"
      />
      <p className="text-xs text-muted-foreground">
        Amber pins are guesses, green pins are where the photo was taken. Select a photo to pick it
        out on the map.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((detail) => {
          const km = getNumberProperty(detail.result?.detail, "km");
          const sourceUrl = getStringProperty(detail.reveal, "sourceUrl");

          return (
            <li
              key={detail.item.id}
              className="overflow-hidden rounded-xl border border-border bg-surface"
            >
              <button
                type="button"
                aria-pressed={activeId === detail.item.id}
                onClick={() =>
                  setActiveId((current) => (current === detail.item.id ? null : detail.item.id))
                }
                className="block w-full text-left aria-pressed:bg-selection"
              >
                {detail.item.imagePath ? (
                  <img
                    src={benchmarkAssetUrl(detail.item.imagePath)}
                    alt={`Street view in ${getStringProperty(detail.reveal, "place") ?? "somewhere"}`}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : null}
                <span className="block space-y-1 p-3 pb-1 text-sm">
                  <span className="block font-medium text-foreground">
                    {getStringProperty(detail.reveal, "place")},{" "}
                    {getStringProperty(detail.reveal, "country")}
                  </span>
                  <span className="block text-muted-foreground tabular-nums">
                    {detail.result?.error
                      ? "No answer"
                      : km === undefined
                        ? "Unparseable guess"
                        : `${km.toLocaleString("en-GB")} km off · ${Math.round((detail.result?.score ?? 0) * 5000).toLocaleString("en-GB")} pts`}
                  </span>
                </span>
              </button>
              <div className="px-3 pb-3">
                <p className="text-xs text-muted-foreground">
                  {sourceUrl ? (
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline underline-offset-2"
                    >
                      {getStringProperty(detail.reveal, "author")}
                    </a>
                  ) : (
                    getStringProperty(detail.reveal, "author")
                  )}{" "}
                  · {getStringProperty(detail.reveal, "licence")}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
