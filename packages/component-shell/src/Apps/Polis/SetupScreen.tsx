import { Button } from "@ngriffin_uk/polychat-component-ui";
import { seedFromText } from "@ngriffin_uk/polychat-library-polis";
import { formatCompactCount } from "@ngriffin_uk/polychat-utility-core";
import { Dices, Landmark } from "lucide-react";
import { type FormEvent, useState } from "react";

import { PastTowns } from "./PastTowns.js";
import type { PolisEngine } from "./usePolisEngine.js";

const POPULATIONS = [1000, 5000, 10000, 25000, 50000];

export function SetupScreen({ engine }: { engine: PolisEngine }) {
  const [population, setPopulation] = useState(10000);
  const [name, setName] = useState("");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000).toString());

  const found = (event: FormEvent) => {
    event.preventDefault();

    engine.send({
      type: "create",
      population,
      seed: seedFromText(seed),
      name: name.trim() || undefined,
    });
    engine.send({ type: "running", running: true });
  };

  if (engine.restoring) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#6e8f5f] p-4">
        <div className="w-full max-w-sm space-y-2 rounded-2xl border-2 border-foreground/80 bg-card p-6 shadow-xl">
          <p className="font-display text-2xl leading-tight">Rebuilding {engine.restoring.name}</p>
          <p className="text-sm text-muted-foreground">
            Replaying everything that happened, exactly as it did.
          </p>
          <div className="h-1.5 overflow-hidden rounded-sm bg-border">
            <div
              className="h-full rounded-sm bg-foreground"
              style={{ width: `${engine.restoring.progress * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-start justify-center overflow-y-auto bg-[#6e8f5f] p-4 sm:items-center">
      <form
        onSubmit={found}
        className="w-full max-w-md space-y-5 rounded-2xl border-2 border-foreground/80 bg-card p-6 shadow-xl"
      >
        <div className="space-y-1">
          <p className="font-display text-4xl leading-tight">Found a town</p>
          <p className="text-sm text-muted-foreground">
            Everyone in it gets a job, a home, a family and something they want from life. Then you
            change the rules and see who cheers.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">People</legend>
          <div className="grid grid-cols-5 gap-1">
            {POPULATIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={population === option}
                onClick={() => setPopulation(option)}
                className={
                  population === option
                    ? "rounded-md bg-foreground py-2 font-mono text-sm text-background tabular-nums"
                    : "rounded-md border border-border py-2 font-mono text-sm tabular-nums hover:border-foreground/50"
                }
              >
                {formatCompactCount(option)}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block space-y-1 text-sm font-medium">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            placeholder="Leave blank to let the map decide"
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm font-normal outline-none focus:border-foreground/60"
          />
        </label>

        <label className="block space-y-1 text-sm font-medium">
          <span>Seed</span>
          <span className="flex gap-2">
            <input
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              maxLength={24}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 font-mono text-sm font-normal outline-none focus:border-foreground/60"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="New seed"
              onClick={() => setSeed(Math.floor(Math.random() * 1_000_000).toString())}
            >
              <Dices size={16} />
            </Button>
          </span>
          <span className="block text-xs font-normal text-muted-foreground">
            The same seed founds the same town.
          </span>
        </label>

        <Button
          type="submit"
          variant="primary"
          disabled={!engine.ready}
          icon={<Landmark size={16} />}
        >
          Found it
        </Button>

        <PastTowns engine={engine} />
      </form>
    </div>
  );
}
