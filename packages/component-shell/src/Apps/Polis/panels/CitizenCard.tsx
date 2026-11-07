import { Button } from "@ngriffin_uk/polychat-component-ui";
import { YEAR_DAYS } from "@ngriffin_uk/polychat-library-polis";
import { formatCompactCount } from "@ngriffin_uk/polychat-utility-core";
import { Crosshair, Shuffle, X } from "lucide-react";

import type { PolisEngine } from "../usePolisEngine.js";

export function CitizenCard({ engine }: { engine: PolisEngine }) {
  const citizen = engine.status?.citizen;

  if (!citizen) {
    return (
      <div className="absolute top-20 left-3">
        <Button
          variant="secondary"
          size="sm"
          icon={<Shuffle size={14} />}
          onClick={() => engine.send({ type: "followRandom" })}
        >
          Follow someone
        </Button>
      </div>
    );
  }

  return (
    <div className="absolute top-20 left-3 max-h-[calc(100%-9rem)] w-64 overflow-y-auto rounded-lg border border-border bg-card/95 p-3 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg leading-tight">{citizen.name}</p>
          <p className="text-xs text-muted-foreground">
            {citizen.age}, wants {citizen.aspiration}
          </p>
        </div>
        <div className="flex">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Find them on the map"
            onClick={() => engine.send({ type: "focusFollowed" })}
          >
            <Crosshair size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Stop following"
            onClick={() => engine.send({ type: "follow", person: -1 })}
          >
            <X size={14} />
          </Button>
        </div>
      </div>
      <dl className="mt-2 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-0.5 text-xs">
        <dt className="text-muted-foreground">Work</dt>
        <dd>{citizen.occupation}</dd>
        <dt className="text-muted-foreground">Home</dt>
        <dd>{citizen.home}</dd>
        <dt className="text-muted-foreground">Pay</dt>
        <dd className="font-mono tabular-nums">
          {citizen.wage > 0 ? `£${citizen.wage.toLocaleString("en-GB")} a month` : "None"}
        </dd>
        <dt className="text-muted-foreground">Savings</dt>
        <dd className="font-mono tabular-nums">
          £{formatCompactCount(Math.round(citizen.wealth))}
        </dd>
        {citizen.mortgage > 0 && (
          <>
            <dt className="text-muted-foreground">Mortgage</dt>
            <dd className="font-mono tabular-nums">
              £{formatCompactCount(Math.round(citizen.mortgage))}
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">Mood</dt>
        <dd className="font-mono tabular-nums">{citizen.mood}/100</dd>
        <dt className="text-muted-foreground">Family</dt>
        <dd>
          {citizen.partner ? `With ${citizen.partner}` : "Single"}
          {citizen.children > 0 ? `, ${citizen.children} at home` : ""}
        </dd>
      </dl>
      {citizen.life.length > 0 && (
        <ol className="mt-2 space-y-0.5 border-t border-border pt-2">
          {citizen.life.slice(0, 8).map((entry, index) => (
            <li key={`${entry.day}-${index}`} className="flex gap-2 text-xs">
              <span className="shrink-0 font-mono text-muted-foreground tabular-nums">
                Y{Math.floor(entry.day / YEAR_DAYS) + 1}
              </span>
              <span>{entry.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
