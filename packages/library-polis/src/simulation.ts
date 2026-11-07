import { MONTH_DAYS } from "./constants.js";
import { storeDecisionAnswers } from "./decisions.js";
import { createJournal, journalUpTo } from "./journal.js";
import { enactLaw, repealLaw, setParameters } from "./laws.js";
import { endMonth } from "./macro.js";
import { applyScenario } from "./scenarios.js";
import { createWorld } from "./seed.js";
import { settlePerson } from "./settlement.js";
import type { World, WorldConfig, WorldEvent } from "./world.js";

export function stepDay(world: World): void {
  const { people, capacity, day } = world;
  const slice = day % MONTH_DAYS;

  for (let person = slice; person < capacity; person += MONTH_DAYS) {
    if (people.alive[person]) {
      settlePerson(world, person);
    }
  }

  world.day += 1;

  if (world.day % MONTH_DAYS === 0) {
    endMonth(world);
  }
}

function applyEvent(world: World, event: WorldEvent): void {
  switch (event.type) {
    case "law":
      enactLaw(world, event.law);
      break;
    case "repeal":
      repealLaw(world, event.id);
      break;
    case "parameters":
      setParameters(world, event.values);
      break;
    case "scenario":
      applyScenario(world, event.scenario);
      break;
    default:
      storeDecisionAnswers(world, event.epoch, event.answers);
  }
}

export function dispatch(world: World, event: WorldEvent): void {
  if (world.recording) {
    world.log.push(event);
  }

  world.eventsApplied += 1;
  applyEvent(world, event);
}

export function forkWorld(world: World): World {
  return structuredClone(world);
}

export function createKeyframe(world: World): World {
  return structuredClone({ ...world, log: [], journal: createJournal(1), recording: false });
}

export function continueFrom(world: World, source: World, id: string): World {
  world.config = { ...world.config, id };
  world.log = source.log.slice(0, world.eventsApplied);
  world.journal = journalUpTo(source.journal, world.day);
  world.recording = true;

  return world;
}

export function advanceTo(
  world: World,
  log: readonly WorldEvent[],
  day: number,
  deadline = Infinity,
): boolean {
  for (;;) {
    while (world.eventsApplied < log.length && log[world.eventsApplied].day <= world.day) {
      dispatch(world, log[world.eventsApplied]);
    }

    if (world.day >= day) {
      return true;
    }

    if (performance.now() >= deadline) {
      return false;
    }

    stepDay(world);
  }
}

export function replayWorld(config: WorldConfig, log: readonly WorldEvent[], day: number): World {
  const world = createWorld(config);

  advanceTo(world, log, day);

  return world;
}

export function worldHash(world: World): string {
  let hash = 2166136261;
  const mix = (value: number) => {
    hash = Math.imul(hash ^ (value | 0), 16777619);
    hash = Math.imul(hash ^ Math.floor(value / 4294967296), 16777619);
  };

  mix(world.day);
  mix(world.population);
  world.accounts.forEach(mix);

  return (hash >>> 0).toString(16);
}

export function moneySupply(world: World): number {
  return world.accounts.reduce((sum, balance) => sum + balance, 0);
}
