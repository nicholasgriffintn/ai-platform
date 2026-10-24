import { OWNER } from "./identity.mjs";
import { at, insert, NOW, seedId } from "./sql.mjs";

const EDITION_ID = seedId("discover", "edition", "today");

function editionContent(date, generatedAt) {
  return {
    version: 1,
    date,
    timezone: "Europe/London",
    greeting: "Good morning",
    interests: [
      { topic: "Lisbon trip", reason: "You planned a Lisbon weekend in chat last week." },
      { topic: "WebGPU", reason: "You asked about WebGPU support twice this month." },
      { topic: "Habits", reason: "Your Build Better Habits notebook." },
      { topic: "Films", reason: "Your Films of the Century notebook." },
    ],
    brief: [
      {
        kind: "waiting",
        label: "Waiting on you",
        text: "Approve the Northstar launch announcement",
      },
      {
        kind: "calendar",
        label: "Lisbon trip",
        text: "Feira da Ladra is on this Saturday, 9:00 to 18:00",
      },
      {
        kind: "topic",
        label: "WebGPU",
        text: "Safari's WebGPU support is now on by default in the latest beta",
      },
      {
        kind: "on_this_day",
        label: "On this day",
        text: "1946: a V-2 rocket takes the first photo of Earth from space",
        href: "https://en.wikipedia.org/wiki/The_Earth_as_seen_from_V-2_rocket_No._13",
      },
    ],
    cards: [
      {
        id: seedId("discover", "card", "lisbon"),
        kind: "topic",
        topic: "Lisbon trip",
        title: "Lisbon after dark",
        angle:
          "You've sorted the days. The evenings are open: fado in Alfama, late jazz in Belém and where locals eat after ten.",
        prompt:
          "Help me plan the evenings of my Lisbon weekend: fado, late jazz and somewhere good to eat after ten.",
        reason: "You planned a Lisbon weekend in chat last week.",
      },
      {
        id: seedId("discover", "card", "webgpu"),
        kind: "read",
        topic: "WebGPU",
        title: "WebGPU implementation status",
        url: "https://github.com/gpuweb/gpuweb/wiki/Implementation-Status",
        source: "gpuweb on GitHub",
        summary:
          "The working group's tracker of which browsers ship WebGPU, behind which flags, and on which platforms.",
        reason: "You asked about WebGPU support twice this month.",
      },
      {
        id: seedId("discover", "card", "habits"),
        kind: "topic",
        topic: "Habits",
        title: "Why streaks break on day four",
        angle:
          "Your habits notebook covers the loop. Today's angle is the dip after the first few days and what makes people push through it.",
        prompt:
          "Using what I've collected on habits, explain why new streaks tend to break after a few days and give me three ways to get past it.",
        reason: "Your Build Better Habits notebook.",
      },
      {
        id: seedId("discover", "card", "groceries"),
        kind: "action",
        title: "Make the Sunday grocery list automatic",
        detail:
          "You've asked for a grocery list three Sundays running. An automation could have it ready each week.",
        when: "Sundays 09:00",
        prompt:
          "Set up an automation that writes my grocery list every Sunday at 09:00. Show me the schedule before you create it.",
        reason: "Three Sunday grocery chats in a row.",
      },
      {
        id: seedId("discover", "card", "films"),
        kind: "read",
        topic: "Films",
        title: "Sight and Sound's critics' poll",
        url: "https://www.bfi.org.uk/sight-and-sound/greatest-films-all-time",
        source: "BFI",
        summary:
          "The once-a-decade critics' poll of the greatest films, a useful counterweight to the box-office view in your notebook.",
        reason: "Your Films of the Century notebook.",
      },
      {
        id: seedId("discover", "card", "checkin"),
        kind: "check_in",
        question: "Did the jazz festival tickets come through for Saturday?",
        reason: "You were waiting on tickets on Tuesday.",
      },
    ],
    generatedAt,
  };
}

export function discoverStatements() {
  const date = NOW.toISOString().slice(0, 10);
  const createdAt = at({ hours: 2 });
  const content = editionContent(date, createdAt);
  const title = `Discover, ${date}`;

  return [
    insert("resource", {
      resource_type: "output",
      id: EDITION_ID,
      created_by_user_id: OWNER.id,
      scope_type: "personal",
      scope_id: String(OWNER.id),
      capability_id: "discover",
      group_id: `discover:${date}`,
      kind: "discover.edition",
      title,
      status: "ready",
      sensitivity: "personal",
      content,
      provenance_json: {
        protocolVersion: 1,
        capturedAt: createdAt,
        completeness: "partial",
        origin: "generated",
        run: null,
        model: null,
        skills: [],
        sources: [],
        approvals: [],
      },
      revision: 1,
      created_at: createdAt,
      updated_at: createdAt,
      revision_created_by_user_id: OWNER.id,
      revision_created_at: createdAt,
      revision_operation: "created",
    }),
    insert("resource_revision", {
      resource_type: "output",
      output_id: EDITION_ID,
      revision: 1,
      title,
      status: "ready",
      sensitivity: "personal",
      content,
      created_by_user_id: OWNER.id,
      created_at: createdAt,
      operation: "created",
    }),
  ];
}
