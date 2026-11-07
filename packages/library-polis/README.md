# @ngriffin_uk/polychat-library-polis

A seeded town simulation with no I/O of its own. A world holds people, homes, firms and every unit of money as typed arrays, so 50,000 residents step in a few milliseconds and a whole world can be cloned, forked or replayed. Wire contracts (laws, scenarios, decision buckets, recordings) stay in `@ngriffin_uk/polychat-schemas`. Hosts own timers, rendering, storage and model calls.

```ts
import {
  createWorld,
  dispatch,
  stepDay,
  takeDecisionBuckets,
} from "@ngriffin_uk/polychat-library-polis";

const world = createWorld({ population: 10_000, seed: 42 });

stepDay(world);
dispatch(world, { type: "parameters", day: world.day, values: { rentCapPct: 3 } });

const buckets = takeDecisionBuckets(world, 12);
```

## How people decide

Daily life is plain code. Big life choices go through `decisionFor`, which groups residents into buckets by age, wealth, work, housing, aspiration and the state of the town. A model answers once per bucket and everyone in it rolls against that probability, so a town of any size needs a few hundred answers rather than millions. Buckets without an answer use `localInclinations`, which keeps the town running with no model at all. Changing a law clears the answers, so people re-decide under the new rules.

## Recordings

Everything that comes from outside the simulation is an event in `world.log`: laws, repeals, parameter changes, scenarios and model answers, each with its day. Together with the seed, that log is a complete recording, because `stepDay` is deterministic. `replayWorld` rebuilds a world from it, and `advanceTo` plays one forward to any day, optionally within a time budget.

`createKeyframe` takes a compact copy so a host can seek without replaying from day zero. `world.journal` records every life event with its day and hour, and `continueFrom` turns a past moment into a new live world with its own future.

A recording only replays exactly under the rules it ran with, so changing how the simulation behaves changes what old recordings show.

## Money

Every payment goes through `pay`, which moves whole units between accounts. Accounts always sum to zero, including the outside world, so `moneySupply(world)` returning anything else is a bug.
