import { Input } from "@ngriffin_uk/polychat-component-ui";
import { benchmarkAssetUrl } from "@ngriffin_uk/polychat-library-client";
import type { BenchmarkId, BenchmarkItemPublic } from "@ngriffin_uk/polychat-schemas";
import {
  formatProbabilityPercent,
  getNumberProperty,
  getStringProperty,
  readArray,
  readFiniteNumber,
} from "@ngriffin_uk/polychat-utility-core";

import { GeoMap } from "../geo/GeoMap.js";

interface InputProps {
  item: BenchmarkItemPublic;
  value: unknown;
  onChange: (value: unknown) => void;
}

function GeoguessInput({ item, value, onChange }: InputProps) {
  const lat = getNumberProperty(value, "lat");
  const lng = getNumberProperty(value, "lng");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {item.imagePath ? (
        <img
          src={benchmarkAssetUrl(item.imagePath)}
          alt="Where was this taken?"
          className="w-full rounded-xl object-cover"
        />
      ) : null}
      <div className="space-y-2">
        <GeoMap
          pairs={
            lat !== undefined && lng !== undefined
              ? [{ id: "pin", truth: null, guess: { lat, lng }, label: "Your pin" }]
              : []
          }
          onPick={(point) => onChange({ lat: point.lat, lng: point.lng })}
          ariaLabel="Click the map to drop your pin"
        />
        <p className="text-xs text-muted-foreground tabular-nums">
          {lat !== undefined && lng !== undefined
            ? `Pinned at ${lat.toFixed(2)}, ${lng.toFixed(2)}. Click again to move it.`
            : "Click the map to drop your pin, or type coordinates."}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(["lat", "lng"] as const).map((field) => (
            <label key={field} className="space-y-1 text-xs text-muted-foreground">
              <span>{field === "lat" ? "Latitude" : "Longitude"}</span>
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                min={field === "lat" ? -90 : -180}
                max={field === "lat" ? 90 : 180}
                value={(field === "lat" ? lat : lng) ?? ""}
                onChange={(event) =>
                  onChange({
                    lat,
                    lng,
                    [field]: event.target.value === "" ? undefined : Number(event.target.value),
                  })
                }
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function CountdownInput({ item, value, onChange }: InputProps) {
  const numbers = readArray(item.data.numbers)
    .map(readFiniteNumber)
    .filter((number) => number !== undefined);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {numbers.map((number, index) => (
          <span
            key={`${number}-${index}`}
            className="flex h-12 min-w-12 items-center justify-center rounded-lg bg-active-work px-3 font-display text-xl text-canvas tabular-nums"
          >
            {number}
          </span>
        ))}
        <span className="ml-2 font-display text-4xl text-accent-amber tabular-nums">
          {getNumberProperty(item.data, "target")}
        </span>
      </div>
      <Input
        aria-label="Your working"
        placeholder="(75 + 25) * 3 - 7"
        value={getStringProperty(value, "expression") ?? ""}
        onChange={(event) => onChange({ expression: event.target.value })}
        className="font-mono"
      />
    </div>
  );
}

function FermiInput({ item, value, onChange }: InputProps) {
  const fields = ["low", "estimate", "high"] as const;
  const labels = { low: "Low (90%)", estimate: "Best guess", high: "High (90%)" };

  return (
    <div className="space-y-4">
      <p className="font-display text-2xl text-foreground">
        {getStringProperty(item.data, "question")}
      </p>
      <p className="text-sm text-muted-foreground">
        In {getStringProperty(item.data, "unit")}. Give a range you would bet holds the answer nine
        times in ten.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {fields.map((field) => (
          <label key={field} className="space-y-1 text-sm">
            <span className="text-muted-foreground">{labels[field]}</span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={getNumberProperty(value, field) ?? ""}
              onChange={(event) =>
                onChange({
                  low: getNumberProperty(value, "low"),
                  estimate: getNumberProperty(value, "estimate"),
                  high: getNumberProperty(value, "high"),
                  [field]: event.target.value === "" ? undefined : Number(event.target.value),
                })
              }
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function LongOddsInput({ item, value, onChange }: InputProps) {
  const probability = getNumberProperty(value, "probability") ?? 0.5;

  return (
    <div className="space-y-4">
      <p className="font-display text-2xl text-foreground">
        {getStringProperty(item.data, "question")}
      </p>
      <label className="block space-y-2 text-sm">
        <span className="text-muted-foreground">
          Chance the answer is yes:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatProbabilityPercent(probability)}
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(probability * 100)}
          onChange={(event) => onChange({ probability: Number(event.target.value) / 100 })}
          className="w-full accent-accent-amber"
        />
      </label>
    </div>
  );
}

function YesManInput({ item, value, onChange }: InputProps) {
  return (
    <div className="space-y-4">
      <p className="font-display text-2xl text-foreground">
        {getStringProperty(item.data, "prompt")}
      </p>
      <p className="text-sm text-muted-foreground">
        Answer the question as it stands, whatever the person asking believes.
      </p>
      <Input
        aria-label="Your answer"
        placeholder="A short answer"
        value={getStringProperty(value, "answer") ?? ""}
        onChange={(event) => onChange({ answer: event.target.value })}
      />
    </div>
  );
}

export function PlayAnswerInput({
  benchmarkId,
  ...props
}: InputProps & { benchmarkId: BenchmarkId }) {
  switch (benchmarkId) {
    case "geoguess":
      return <GeoguessInput {...props} />;
    case "countdown":
      return <CountdownInput {...props} />;
    case "fermi-bets":
      return <FermiInput {...props} />;
    case "long-odds":
      return <LongOddsInput {...props} />;
    case "yes-man":
      return <YesManInput {...props} />;
    default:
      return null;
  }
}
