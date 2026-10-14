import z from "zod/v4";

import {
  STRUDEL_FUNCTIONS,
  STRUDEL_TRANSFORMS,
  checkStrudelCode,
  extractStrudelCode,
} from "../artefacts/strudel.js";
import { defineBenchmark, gateScore } from "../define.js";

interface GrooveMood {
  mood: string;
}

const MOODS: readonly { id: string; mood: string }[] = [
  { id: "rainy-cafe", mood: "A rainy Sunday morning in a Lisbon café" },
  { id: "boss-battle", mood: "The final phase of an 8-bit boss battle" },
  { id: "parrot-conga", mood: "A parrot conga line along a perch at sunset" },
];

const answerSchema = z.object({ code: z.string().min(1).max(20_000) });

type GrooveAnswer = z.infer<typeof answerSchema>;

const SYSTEM = [
  "You compose live-coded music in Strudel, the JavaScript port of TidalCycles.",
  "Return one pattern in a single ```js code block and nothing else.",
  `Start chains only with these functions: ${STRUDEL_FUNCTIONS.join(", ")}.`,
  "Chain methods freely, for example .s(), .bank(), .gain(), .lpf(), .room(), .fast(), .slow(), .every(), .scale().",
  `When a method takes a transform, pass one of these by name, for example .jux(rev) or .every(4, fast): ${STRUDEL_TRANSFORMS.join(", ")}.`,
  'Use double-quoted mini-notation strings such as "c3 [e3 g3] <a3 b3>". Never put quotes inside a string: group alternatives with [ ] inside < > instead. Use $: at the start of a line for each extra layer.',
  "Do not use variables, assignments, arrow functions, template strings, square brackets outside strings, semicolons or samples().",
  "Keep it under 4,000 characters and make it loop well for about 16 bars.",
].join(" ");

export const STRUDEL_JUDGE_RUBRIC = [
  "Judge this Strudel pattern as music for the requested mood, reading the code to imagine how it sounds.",
  "5: fits the mood vividly, coherent rhythm and harmony, layers that develop over the loop.",
  "4: fits the mood with good structure and minor rough edges.",
  "3: plausible music with only a loose link to the mood.",
  "2: thin, repetitive or musically muddled.",
  "1: not meaningful music or ignores the mood.",
].join("\n");

export const strudelGroove = defineBenchmark<GrooveMood, GrooveAnswer>({
  summary: {
    id: "strudel-groove",
    version: 1,
    name: "Strudel Groove",
    tagline: "Sixteen bars, one mood, no samples",
    description:
      "Each model writes a looping Strudel pattern for three moods. Press play on blind pairs and vote for the one that grooves.",
    method:
      "Three moods, one pattern each. Patterns must pass a strict grammar check, so only Strudel functions and literal mini-notation run in your browser, or they score zero. Signed-in visitors vote on blind pairs of the same mood and a Bradley–Terry fit turns votes into ratings. A fixed judge model orders the board until votes arrive.",
    category: "Creative",
    scoring: "votes",
    input: "text",
    artefact: "strudel",
    playable: false,
    decisionModels: false,
    itemsPerPlay: MOODS.length,
    scoreScale: 100,
    scoreUnit: "/ 100 judge",
    metrics: [{ key: "gatePassRate", label: "Passed the checks", format: "percent" }],
    credit: { label: "Played with Strudel", url: "https://strudel.cc" },
  },
  items: MOODS.map((mood) => ({ id: mood.id, truth: { mood: mood.mood } })),
  answerSchema,
  prompt: (item) => ({
    system: SYSTEM,
    user: `Write a Strudel pattern for this mood: ${item.truth.mood}.`,
    imageItemId: null,
  }),
  publicData: (item) => ({ mood: item.truth.mood }),
  parse: (output) => {
    const code = extractStrudelCode(output);

    return code ? { code } : null;
  },
  score: (_item, answer) => gateScore(checkStrudelCode(answer.code).reasons),
  artefact: (answer) => ({ kind: "strudel", content: answer.code }),
  reveal: (item) => ({ mood: item.truth.mood }),
  metrics: (results) => ({
    gatePassRate:
      results.length === 0
        ? 0
        : results.filter((result) => result.detail.gate === true).length / results.length,
  }),
  judgeRubric: STRUDEL_JUDGE_RUBRIC,
});
