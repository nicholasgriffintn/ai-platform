import {
  DISCOVER_CAPABILITY_ID,
  DISCOVER_EDITION_KIND,
  DISCOVER_EPISODE_KIND,
  DISCOVER_EPISODES_CAPABILITY_ID,
  DISCOVER_FEEDBACK_KIND,
  DISCOVER_RECIPE_ID,
  DISCOVER_SEASON_KIND,
  DISCOVER_WIND_DOWN_KIND,
  discoverEditionContentSchema,
  discoverEpisodeContentSchema,
  discoverSeasonContentSchema,
  discoverWindDownContentSchema,
  PLATFORM_TEAMMATE_AUTHOR_USER_ID,
  PLATFORM_TEAMMATE_SCOPE_ID,
  POLY_TEAMMATE_ID,
} from "@ngriffin_uk/polychat-schemas";

import { OWNER } from "./identity.mjs";
import { seedFile } from "./sources.mjs";
import { at, insert, NOW, seedId, shift } from "./sql.mjs";

const TIME_ZONE = "Europe/London";
const POLY_CONTEXT_ID = seedId("teammate-context", "poly");
const POLY_HOME_ID = seedId("poly", "home");
const POLY_MEMORY_ID = seedId("teammate-memory", "poly");
const DISCOVER_TRIGGER_ID = seedId("discover", "trigger");
const SEASON_ID = seedId("discover", "season", "habits");
const EPISODE_IDS = [
  seedId("discover", "episode", "habits-1"),
  seedId("discover", "episode", "habits-2"),
];
const CHAPTER_AUDIO_SECONDS = 66.39;

function dateOf(daysAgo) {
  return new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

function editionId(daysAgo) {
  return daysAgo === 0
    ? seedId("discover", "edition", "today")
    : seedId("discover", "edition", `d${daysAgo}`);
}

function cardId(key) {
  return seedId("discover", "card", key);
}

const TODAY_CARDS = [
  {
    id: cardId("lisbon"),
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
    id: cardId("webgpu"),
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
    id: cardId("habits"),
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
    id: cardId("groceries"),
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
    id: cardId("films"),
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
    id: cardId("checkin"),
    kind: "check_in",
    question: "Did the jazz festival tickets come through for Saturday?",
    reason: "You were waiting on tickets on Tuesday.",
  },
];

const EARLIER_CARDS = {
  1: [
    {
      id: cardId("d1-habits"),
      kind: "read",
      topic: "Habits",
      title: "Atomic Habits: the four laws",
      url: "https://jamesclear.com/three-steps-habit-change",
      source: "James Clear",
      summary: "Cue, craving, response and reward, and how to make each one work for you.",
      reason: "Your Build Better Habits notebook.",
    },
    {
      id: cardId("d1-webgpu"),
      kind: "topic",
      topic: "WebGPU",
      title: "Compute shaders for the curious",
      angle: "Skip the triangles. What can you do with WebGPU compute in an afternoon?",
      prompt:
        "Give me an afternoon project that uses WebGPU compute shaders, with the smallest working example.",
      reason: "You asked about WebGPU support twice this month.",
    },
    {
      id: cardId("d1-lisbon"),
      kind: "read",
      topic: "Lisbon trip",
      title: "Feira da Ladra, Lisbon's flea market",
      url: "https://www.visitlisboa.com/en/places/feira-da-ladra",
      source: "Visit Lisboa",
      summary: "Tuesdays and Saturdays at Campo de Santa Clara, best before noon.",
      reason: "You planned a Lisbon weekend in chat last week.",
    },
  ],
  2: [
    {
      id: cardId("d2-films"),
      kind: "topic",
      topic: "Films",
      title: "The quiet rise of the two-hander",
      angle: "Your notebook's indie list leans on films with two actors and one room. Why now?",
      prompt: "From my films notebook, why have two-hander films become more common this century?",
      reason: "Your Films of the Century notebook.",
    },
    {
      id: cardId("d2-habits"),
      kind: "read",
      topic: "Habits",
      title: "How long it takes to form a habit",
      url: "https://onlinelibrary.wiley.com/doi/10.1002/ejsp.674",
      source: "European Journal of Social Psychology",
      summary:
        "The 2009 study behind the 66-day median, and why the range runs from 18 to 254 days.",
      reason: "Your Build Better Habits notebook.",
    },
  ],
};

function editionContent(daysAgo) {
  const date = dateOf(daysAgo);
  const today = daysAgo === 0;

  return discoverEditionContentSchema.parse({
    version: 1,
    date,
    timezone: TIME_ZONE,
    greeting: "Good morning",
    edition: "morning",
    interests: [
      { topic: "Lisbon trip", reason: "You planned a Lisbon weekend in chat last week." },
      { topic: "WebGPU", reason: "You asked about WebGPU support twice this month." },
      { topic: "Habits", reason: "Your Build Better Habits notebook." },
      { topic: "Films", reason: "Your Films of the Century notebook." },
    ],
    brief: today
      ? [
          {
            kind: "waiting",
            label: "Waiting on you",
            text: "Atlas needs your call on shipping quoted selections behind a flag",
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
        ]
      : [
          {
            kind: "topic",
            label: "Habits",
            text: "Day two of the habits season is ready to watch",
          },
        ],
    cards: today ? TODAY_CARDS : EARLIER_CARDS[daysAgo],
    ...(daysAgo === 1 ? { episodeId: EPISODE_IDS[1] } : {}),
    ...(daysAgo === 2 ? { episodeId: EPISODE_IDS[0] } : {}),
    generatedAt: at({ days: daysAgo, hours: 2 }),
  });
}

function provenance(createdAt) {
  return {
    protocolVersion: 1,
    capturedAt: createdAt,
    completeness: "partial",
    origin: "generated",
    run: null,
    model: null,
    skills: [],
    sources: [],
    approvals: [],
  };
}

function personalOutput({
  id,
  capabilityId,
  groupId,
  kind,
  title,
  content,
  createdAt,
  metadata = {},
}) {
  return [
    insert("resource", {
      resource_type: "output",
      id,
      created_by_user_id: OWNER.id,
      scope_type: "personal",
      scope_id: String(OWNER.id),
      capability_id: capabilityId,
      group_id: groupId,
      kind,
      title,
      status: "ready",
      sensitivity: "personal",
      content,
      metadata,
      provenance_json: provenance(createdAt),
      revision: 1,
      created_at: createdAt,
      updated_at: createdAt,
      revision_created_by_user_id: OWNER.id,
      revision_created_at: createdAt,
      revision_operation: "created",
    }),
    insert("resource_revision", {
      resource_type: "output",
      output_id: id,
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

function polyStatements() {
  const createdAt = at({ days: 30 });
  const memory =
    "# Poly\n\n- Morning edition at 07:00, evening edition off.\n- Follows Habits and Films.";

  return [
    insert("teammates", {
      id: POLY_TEAMMATE_ID,
      user_id: PLATFORM_TEAMMATE_AUTHOR_USER_ID,
      owner_scope_type: "platform",
      owner_scope_id: PLATFORM_TEAMMATE_SCOPE_ID,
      kind: "colleague",
      workspace_default: false,
      name: "Poly",
      servers: [],
      mode: "chat",
      created_at: createdAt,
      updated_at: createdAt,
    }),
    insert("conversation", {
      id: POLY_HOME_ID,
      user_id: OWNER.id,
      type: "poly",
      title: "Poly",
      message_count: 0,
      created_at: createdAt,
      updated_at: createdAt,
    }),
    insert("resource", {
      resource_type: "memory",
      id: POLY_MEMORY_ID,
      scope_type: "personal",
      scope_id: String(OWNER.id),
      kind: "teammate_context",
      title: "teammate-poly",
      content: memory,
      revision: 1,
      created_by_user_id: OWNER.id,
      created_at: createdAt,
      updated_at: createdAt,
    }),
    insert("resource_revision", {
      resource_type: "memory",
      id: `${POLY_MEMORY_ID}-r1`,
      document_id: POLY_MEMORY_ID,
      revision: 1,
      text_content: memory,
      change_note: "Seeded",
      operation_id: `seed:${POLY_MEMORY_ID}`,
      created_by: OWNER.id,
      created_at: createdAt,
    }),
    insert("teammate_context", {
      id: POLY_CONTEXT_ID,
      teammate_id: POLY_TEAMMATE_ID,
      actor_user_id: OWNER.id,
      scope_type: "personal",
      scope_id: String(OWNER.id),
      home_conversation_id: POLY_HOME_ID,
      memory_document_id: POLY_MEMORY_ID,
      status: "active",
      autonomy_level: "assistant",
      created_at: createdAt,
      updated_at: at({ hours: 1 }),
    }),
    insert("template", {
      id: seedId("discover", "installation"),
      created_by_user_id: OWNER.id,
      workspace_id: null,
      kind: "recipe",
      capability_id: DISCOVER_RECIPE_ID,
      name: "Discover",
      description: "A morning edition from Poly.",
      configuration: {
        recipeId: DISCOVER_RECIPE_ID,
        status: "active",
        triggers: [
          {
            id: DISCOVER_TRIGGER_ID,
            type: "schedule",
            enabled: true,
            cronExpression: "0 7 * * *",
            timezone: TIME_ZONE,
          },
        ],
        configuration: { evening: false, listen: true, episode: "standard", style: "watercolour" },
        scheduleState: {
          [DISCOVER_TRIGGER_ID]: {
            triggerId: DISCOVER_TRIGGER_ID,
            cronExpression: "0 7 * * *",
            timezone: TIME_ZONE,
            enabled: true,
            activatedAt: createdAt,
            lastRunKey: `${DISCOVER_TRIGGER_ID}:${dateOf(0)}T07:00`,
          },
        },
        teammateContextId: POLY_CONTEXT_ID,
      },
      status: "active",
      created_at: createdAt,
      updated_at: at({ hours: 2 }),
    }),
  ];
}

const SEASON_PARTS = [
  {
    title: "Day 1 — The loop you already run",
    angle: "Every habit is a cue, a routine and a reward, including the ones you never chose.",
    beats: ["Notice one habit you run without thinking.", "Name its cue, routine and reward."],
  },
  {
    title: "Day 2 — Why day four is hard",
    angle: "The novelty wears off before the reward arrives.",
    beats: ["The dip after the first few days.", "Make the next step smaller, not the goal."],
  },
  {
    title: "Day 3 — Design the cue",
    angle: "Put the cue where you already are.",
    beats: ["Stack the new habit on an old one.", "Make it obvious and close."],
  },
  {
    title: "Day 4 — Make it easy to start",
    angle: "Two minutes is enough to count.",
    beats: ["Shrink the first step.", "Let the streak carry the rest."],
  },
  {
    title: "Day 5 — Keep the reason",
    angle: "The habit lasts when the reason is yours.",
    beats: ["Write down why it matters.", "Review it when the streak breaks."],
  },
];

const EPISODE_SCRIPTS = [
  {
    title: "Day 1 — The Loop You Already Run",
    chapters: [
      [
        "Morning, without deciding",
        [
          "Before the kettle has boiled, the phone is already in your hand. Nobody decided that. It simply happened, the way it happened yesterday.",
          "That is a habit doing its job. A cue, the kitchen at seven. A routine, the scroll. A reward, a small hit of something new.",
          "Hold on to that shape. Every habit you want to build runs on the same three parts.",
        ],
      ],
      [
        "Naming the parts",
        [
          "Pick one habit you run without thinking. Not the one you want to change. Just one you can see clearly.",
          "Say its cue out loud. Then the routine. Then what you get at the end, honestly.",
          "Tomorrow we look at why new habits stall, usually around day four.",
        ],
      ],
    ],
  },
  {
    title: "Day 2 — Why Day Four Is Hard",
    chapters: [
      [
        "The dip",
        [
          "Day one feels good. Day two is still new. By day four, the novelty has gone and the reward has not arrived yet.",
          "That gap is where most streaks end. Not because you failed, but because the habit is asking for effort and giving nothing back.",
          "The answer is not more willpower. It is a smaller step.",
        ],
      ],
      [
        "Smaller, not lower",
        [
          "Keep the goal. Shrink the next step until it takes two minutes.",
          "Two minutes of reading. One push-up. A single line in the journal.",
          "Small steps keep the streak alive long enough for the reward to show up.",
        ],
      ],
    ],
  },
];

const EPISODE_PROGRESS = [
  { furthest: 1, resume: null },
  { furthest: 0.5, resume: { chapter: 1, seconds: 12 } },
];

const SHOT_VISUALS = [
  "A warm kitchen at dawn, a kettle on the hob and a phone glowing on the counter.",
  "Three stepping stones crossing a calm stream, each a different soft colour.",
  "A notebook open on a wooden desk with a single pencil line across the page.",
];

function episodeContent(index) {
  const script = EPISODE_SCRIPTS[index];

  return discoverEpisodeContentSchema.parse({
    format: "episode",
    seasonId: SEASON_ID,
    editionId: editionId(2 - index),
    notebookId: seedId("notebook", "habits"),
    minutes: 5,
    topic: "Habits",
    part: index + 1,
    parts: SEASON_PARTS.length,
    style: "watercolour",
    title: script.title,
    recap: index === 0 ? "" : "Yesterday we named the loop: cue, routine, reward.",
    chapters: script.chapters.map(([title, narration]) => ({
      title,
      beats: narration.slice(0, 2).map((line) => line.split(".")[0]),
      scenes: narration.map((line, scene) => ({
        title: `${title} ${scene + 1}`,
        caption: "",
        narration: line,
        shots: [{ visual: SHOT_VISUALS[scene], motion: "push_in", image: true }],
      })),
      status: "ready",
      timings: narration.map((_line, scene) => ({
        start: (CHAPTER_AUDIO_SECONDS / narration.length) * scene,
        end: (CHAPTER_AUDIO_SECONDS / narration.length) * (scene + 1),
      })),
    })),
  });
}

function episodeFiles(index) {
  const episodeId = EPISODE_IDS[index];
  const { chapters } = EPISODE_SCRIPTS[index];

  return chapters.flatMap(([, narration], chapter) => [
    seedFile(
      "progress-video-narration.mp3",
      "audio/mpeg",
      `outputs/${episodeId}/chapters/${chapter}.mp3`,
    ),
    ...narration.map((_line, scene) =>
      seedFile(
        `progress-scene-${(chapter * narration.length + scene) % 6}.png`,
        "image/png",
        `outputs/${episodeId}/shots/${chapter}-${scene}-0`,
      ),
    ),
  ]);
}

const WIND_DOWNS = [
  {
    key: "unwind",
    kind: "unwind",
    minutes: 10,
    bed: "rain",
    title: "An Unfilled Page",
    summary: "Setting the day's work aside one page at a time.",
    steps: [
      "For these few minutes there is nothing to produce. Keep your eyes open or closed, whichever is easier.",
      "Imagine a loose sheet of paper with nothing written on it. An ordinary page will do.",
      "One thing from your day was the quoted selections decision. Put that title on its own page and set it aside.",
      "It can wait there until morning. You don't have to decide anything now.",
      "Come back to the unfilled page. There is no first line to write and no question waiting.",
    ],
    hoursAgo: 14,
  },
  {
    key: "breathing",
    kind: "breathing",
    minutes: 5,
    bed: "sea",
    title: "Four Slow Breaths",
    summary: "A short count of slow breaths with long exhales.",
    steps: [
      "Let your shoulders drop and breathe in through your nose for a count of four.",
      "Hold gently for a moment, then let it out slowly for a count of six.",
      "Again. In for four, and a long, easy breath out.",
      "Two more like that, at your own pace. Nothing else needs doing.",
    ],
    hoursAgo: 38,
  },
  {
    key: "story",
    kind: "story",
    minutes: 20,
    bed: "embers",
    title: "The Lighthouse Keeper's Garden, part 1",
    summary: "A lighthouse keeper plants a garden on a windy headland.",
    topic: "The Lighthouse Keeper's Garden",
    part: 1,
    steps: [
      "On a headland where the wind never quite stopped, there was a lighthouse, and beside it a small square of earth.",
      "The keeper had always meant to plant something there. This spring, he finally did.",
      "He chose things that liked the wind: thrift, sea kale and a row of stubborn lavender.",
      "Each evening, after lighting the lamp, he walked the rows and counted what had come up.",
      "Tonight, there were three new shoots, and he sat with them until the stars came out.",
    ],
    hoursAgo: 62,
  },
];

function windDownContent(windDown) {
  return discoverWindDownContentSchema.parse({
    format: "wind_down",
    kind: windDown.kind,
    minutes: windDown.minutes,
    title: windDown.title,
    steps: windDown.steps.map((text) => ({ text, pauseSeconds: 12, audio: true })),
    status: "ready",
    bed: windDown.bed,
    ambient: false,
    summary: windDown.summary,
    ...(windDown.topic ? { topic: windDown.topic, part: windDown.part } : {}),
  });
}

function windDownId(key) {
  return seedId("discover", "wind-down", key);
}

export const DISCOVER_FILES = [
  ...EPISODE_IDS.flatMap((_id, index) => episodeFiles(index)),
  ...WIND_DOWNS.flatMap((windDown) =>
    windDown.steps.map((_text, step) =>
      seedFile(
        "standup-recording.mp3",
        "audio/mpeg",
        `outputs/${windDownId(windDown.key)}/steps/${step}.mp3`,
      ),
    ),
  ),
];

const FEEDBACK = [
  [0, "webgpu", "opened"],
  [0, "habits", "more"],
  [0, "films", "saved"],
  [1, "d1-habits", "opened"],
  [1, "d1-habits", "saved"],
  [1, "d1-lisbon", "less"],
  [2, "d2-films", "opened"],
];

function feedbackStatements() {
  return FEEDBACK.map(([daysAgo, key, signal], index) => {
    const edition = editionContent(daysAgo);
    const card = edition.cards.find((candidate) => candidate.id === cardId(key));
    const title = card.title;
    const createdAt = at({ days: daysAgo, hours: 1, minutes: index });

    return insert("activity_record", {
      id: seedId("discover", "feedback", String(index)),
      created_by_user_id: OWNER.id,
      capability_id: DISCOVER_CAPABILITY_ID,
      group_id: `${editionId(daysAgo)}:${card.id}`,
      kind: DISCOVER_FEEDBACK_KIND,
      status: "succeeded",
      summary: `${signal}: ${title}`,
      data: {
        editionId: editionId(daysAgo),
        cardId: card.id,
        signal,
        topic: card.topic ?? null,
        title,
        url: card.url ?? null,
      },
      created_at: createdAt,
      updated_at: createdAt,
    });
  });
}

export function discoverStatements() {
  const statements = [...polyStatements()];

  for (const daysAgo of [2, 1, 0]) {
    const date = dateOf(daysAgo);

    statements.push(
      ...personalOutput({
        id: editionId(daysAgo),
        capabilityId: DISCOVER_CAPABILITY_ID,
        groupId: `discover:${date}`,
        kind: DISCOVER_EDITION_KIND,
        title: `Discover, ${date}`,
        content: editionContent(daysAgo),
        createdAt: at({ days: daysAgo, hours: 2 }),
      }),
    );
  }

  statements.push(
    ...personalOutput({
      id: SEASON_ID,
      capabilityId: DISCOVER_EPISODES_CAPABILITY_ID,
      groupId: "discover-season:habits",
      kind: DISCOVER_SEASON_KIND,
      title: "Build Better Habits",
      content: discoverSeasonContentSchema.parse({
        format: "season",
        title: "Build Better Habits",
        topic: "Habits",
        style: "watercolour",
        parts: SEASON_PARTS,
        cast: [],
        places: [],
        motifs: ["stepping stones"],
        nextPart: 3,
        episodeIds: EPISODE_IDS,
      }),
      createdAt: at({ days: 2, hours: 2 }),
    }),
    ...EPISODE_IDS.flatMap((id, index) =>
      personalOutput({
        id,
        capabilityId: DISCOVER_EPISODES_CAPABILITY_ID,
        groupId: "discover-season:habits",
        kind: DISCOVER_EPISODE_KIND,
        title: EPISODE_SCRIPTS[index].title,
        content: episodeContent(index),
        metadata: { viewerState: { [OWNER.id]: EPISODE_PROGRESS[index] } },
        createdAt: shift(at({ days: 2 - index, hours: 2 }), { minutes: 20 }),
      }),
    ),
    ...WIND_DOWNS.flatMap((windDown) =>
      personalOutput({
        id: windDownId(windDown.key),
        capabilityId: DISCOVER_CAPABILITY_ID,
        groupId: null,
        kind: DISCOVER_WIND_DOWN_KIND,
        title: windDown.title,
        content: windDownContent(windDown),
        createdAt: at({ hours: windDown.hoursAgo }),
      }),
    ),
    ...feedbackStatements(),
  );

  return statements;
}
