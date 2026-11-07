import { hash32 } from "./random.js";

export const LIFE_EVENT_LABELS = {
  arrived: "Arrived in town",
  born: "Was born",
  bought_home: "Bought a home",
  bought_rental: "Bought a place to let",
  better_job: "Moved to a better paid job",
  opened_business: "Opened a business",
  had_child: "Had a child",
  settled_down: "Settled down with a partner",
  went_to_study: "Went back to study",
  retired_early: "Retired early",
  protested: "Joined a protest",
  found_job: "Found a job",
  laid_off: "Was laid off",
  firm_closed: "Lost their job when the firm closed",
  finished_studying: "Finished studying",
  retired: "Retired",
  evicted: "Was evicted",
  repossessed: "Lost their home to the bank",
  left_town: "Left town for good",
  died: "Died",
} as const;

export type LifeEventKind = keyof typeof LIFE_EVENT_LABELS;

export const LIFE_EVENT_KINDS = Object.keys(LIFE_EVENT_LABELS) as LifeEventKind[];

const KIND_INDEX = Object.fromEntries(
  LIFE_EVENT_KINDS.map((kind, index) => [kind, index]),
) as Record<LifeEventKind, number>;

const INITIAL_CAPACITY = 4096;
const FIRST_WAKING_HOUR = 7;
const WAKING_HOURS = 15;

export interface Journal {
  count: number;
  day: Int32Array;
  hour: Uint8Array;
  kind: Uint8Array;
  person: Int32Array;
  firstName: Uint8Array;
  lastName: Uint8Array;
}

export interface JournalEntry {
  day: number;
  hour: number;
  kind: LifeEventKind;
  text: string;
  person: number;
  firstName: number;
  lastName: number;
}

export function createJournal(capacity = INITIAL_CAPACITY): Journal {
  return {
    count: 0,
    day: new Int32Array(capacity),
    hour: new Uint8Array(capacity),
    kind: new Uint8Array(capacity),
    person: new Int32Array(capacity),
    firstName: new Uint8Array(capacity),
    lastName: new Uint8Array(capacity),
  };
}

function grow(journal: Journal): void {
  const next = createJournal(journal.day.length * 2);

  next.day.set(journal.day);
  next.hour.set(journal.hour);
  next.kind.set(journal.kind);
  next.person.set(journal.person);
  next.firstName.set(journal.firstName);
  next.lastName.set(journal.lastName);
  journal.day = next.day;
  journal.hour = next.hour;
  journal.kind = next.kind;
  journal.person = next.person;
  journal.firstName = next.firstName;
  journal.lastName = next.lastName;
}

export function appendToJournal(
  journal: Journal,
  entry: {
    day: number;
    kind: LifeEventKind;
    person: number;
    firstName: number;
    lastName: number;
  },
): void {
  if (journal.count === journal.day.length) {
    grow(journal);
  }

  const index = journal.count;

  journal.day[index] = entry.day;
  journal.hour[index] =
    entry.kind === "born" || entry.kind === "died"
      ? hash32(entry.person * 7 + entry.day) % 24
      : FIRST_WAKING_HOUR + (hash32(entry.person * 13 + entry.day) % WAKING_HOURS);
  journal.kind[index] = KIND_INDEX[entry.kind];
  journal.person[index] = entry.person;
  journal.firstName[index] = entry.firstName;
  journal.lastName[index] = entry.lastName;
  journal.count += 1;
}

function readEntry(journal: Journal, index: number): JournalEntry {
  const kind = LIFE_EVENT_KINDS[journal.kind[index]];

  return {
    day: journal.day[index],
    hour: journal.hour[index],
    kind,
    text: LIFE_EVENT_LABELS[kind],
    person: journal.person[index],
    firstName: journal.firstName[index],
    lastName: journal.lastName[index],
  };
}

function firstIndexAfter(journal: Journal, day: number): number {
  let low = 0;
  let high = journal.count;

  while (low < high) {
    const middle = (low + high) >> 1;

    if (journal.day[middle] <= day) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

export function journalUpTo(journal: Journal, day: number): Journal {
  const count = firstIndexAfter(journal, day);
  const copy = createJournal(Math.max(count, INITIAL_CAPACITY));

  copy.count = count;
  copy.day.set(journal.day.subarray(0, count));
  copy.hour.set(journal.hour.subarray(0, count));
  copy.kind.set(journal.kind.subarray(0, count));
  copy.person.set(journal.person.subarray(0, count));
  copy.firstName.set(journal.firstName.subarray(0, count));
  copy.lastName.set(journal.lastName.subarray(0, count));

  return copy;
}

export function recentEntries(
  journal: Journal,
  day: number,
  hour: number,
  limit: number,
): JournalEntry[] {
  const entries: JournalEntry[] = [];

  for (let index = firstIndexAfter(journal, day) - 1; index >= 0; index -= 1) {
    if (journal.day[index] < day || journal.hour[index] <= hour) {
      entries.push(readEntry(journal, index));

      if (entries.length === limit) {
        break;
      }
    }
  }

  return entries.sort((first, second) => second.day - first.day || second.hour - first.hour);
}

export function lifeOf(
  journal: Journal,
  identity: { person: number; firstName: number; lastName: number; bornOn: number },
  day: number,
  limit: number,
): JournalEntry[] {
  const entries: JournalEntry[] = [];

  for (let index = firstIndexAfter(journal, day) - 1; index >= 0; index -= 1) {
    if (journal.day[index] < identity.bornOn) {
      break;
    }

    if (
      journal.person[index] === identity.person &&
      journal.firstName[index] === identity.firstName &&
      journal.lastName[index] === identity.lastName
    ) {
      entries.push(readEntry(journal, index));

      if (entries.length === limit) {
        break;
      }
    }
  }

  return entries;
}
