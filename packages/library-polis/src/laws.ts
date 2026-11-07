import {
  POLIS_NO_RENT_CAP,
  POLIS_PARAMETER_IDS,
  POLIS_PARAMETERS,
  type PolisAction,
  type PolisCohort,
  type PolisLaw,
  type PolisParameterId,
  type PolisParameters,
} from "@ngriffin_uk/polychat-schemas";

import { employmentBand, resetDecisions, tenureBand, wealthBand } from "./decisions.js";
import { ageOf, chronicle, type World } from "./world.js";

export function defaultParameters(): PolisParameters {
  return Object.fromEntries(
    POLIS_PARAMETER_IDS.map((id) => [id, POLIS_PARAMETERS[id].initial]),
  ) as PolisParameters;
}

function recomputeLaws(world: World): void {
  const parameters = { ...world.baseParameters };

  for (const law of world.laws) {
    for (const { parameter, value } of law.changes) {
      parameters[parameter] = value;
    }
  }

  world.parameters = parameters;
  world.rules = world.laws.flatMap((law) => law.rules);
  resetDecisions(world);
}

export function enactLaw(world: World, law: PolisLaw): number {
  const id = world.nextLawId;

  world.nextLawId += 1;
  world.laws.push({ ...law, id, day: world.day });
  recomputeLaws(world);
  chronicle(world, "law", `${law.title} became law`);

  return id;
}

export function repealLaw(world: World, id: number): void {
  const law = world.laws.find((candidate) => candidate.id === id);

  if (!law) {
    return;
  }

  world.laws = world.laws.filter((candidate) => candidate.id !== id);
  recomputeLaws(world);
  chronicle(world, "law", `${law.title} was repealed`);
}

export function formatParameter(parameter: PolisParameterId, value: number): string {
  const definition = POLIS_PARAMETERS[parameter];

  if (parameter === "rentCapPct" && value >= POLIS_NO_RENT_CAP) {
    return "no cap";
  }

  switch (definition.unit) {
    case "percent":
      return `${value}%`;
    case "money":
      return `${value.toLocaleString("en-GB")} a month`;
    case "age":
      return `${value}`;
    default:
      return `${value} per 1,000`;
  }
}

export function setParameters(world: World, values: Partial<PolisParameters>): void {
  const changed = POLIS_PARAMETER_IDS.filter(
    (id) => values[id] !== undefined && values[id] !== world.baseParameters[id],
  );

  if (changed.length === 0) {
    return;
  }

  world.baseParameters = { ...world.baseParameters, ...values };
  recomputeLaws(world);

  for (const id of changed) {
    chronicle(
      world,
      "law",
      `${POLIS_PARAMETERS[id].label} set to ${formatParameter(id, world.parameters[id])}`,
    );
  }
}

export function matchesCohort(world: World, person: number, cohort: PolisCohort): boolean {
  const age = ageOf(world, person);

  if (
    (cohort.minAge !== null && age < cohort.minAge) ||
    (cohort.maxAge !== null && age > cohort.maxAge)
  ) {
    return false;
  }

  if (cohort.employment !== null) {
    const band = ["employed", "unemployed", "retired", "student"][
      employmentBand(world.people.status[person])
    ];

    if (band !== cohort.employment) {
      return false;
    }
  }

  if (cohort.tenure !== null) {
    const band = ["owner", "renter", "landlord", "homeless"][tenureBand(world, person)];

    if (band !== cohort.tenure) {
      return false;
    }
  }

  if (cohort.wealth !== null) {
    const band = ["in_debt", "poor", "comfortable", "rich"][wealthBand(world, person)];

    if (band !== cohort.wealth) {
      return false;
    }
  }

  return true;
}

export function actionMultiplier(world: World, person: number, action: PolisAction): number {
  let multiplier = 1;

  for (const rule of world.rules) {
    const { effect } = rule;

    if ((effect.kind === "ban" || effect.kind === "nudge") && effect.action === action) {
      if (matchesCohort(world, person, rule.cohort)) {
        multiplier *= effect.kind === "ban" ? 0 : effect.multiplier;
      }
    }
  }

  return multiplier;
}

export function lawLines(world: World): string[] {
  const parameters = POLIS_PARAMETER_IDS.filter(
    (id) => world.parameters[id] !== POLIS_PARAMETERS[id].initial,
  ).map(
    (id) =>
      `${POLIS_PARAMETERS[id].label}: ${formatParameter(id, world.parameters[id])} (was ${formatParameter(id, POLIS_PARAMETERS[id].initial)})`,
  );

  return [...world.laws.map((law) => `${law.title}: ${law.summary}`), ...parameters].slice(-16);
}
