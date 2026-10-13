import z from "zod/v4";

import { checkHtmlArtefact, extractHtmlDocument } from "../artefacts/html.js";
import { defineBenchmark, gateScore } from "../define.js";

const SAMPLES = 3;

const answerSchema = z.object({ html: z.string().min(1).max(200_000) });

type HamsterAnswer = z.infer<typeof answerSchema>;

const SYSTEM = [
  "You are a creative front-end developer who draws with code.",
  "Return one complete, self-contained HTML document in a single ```html code block and nothing else.",
  "Use inline SVG, CSS or a canvas with inline JavaScript. Load nothing from the network: no external scripts, fonts, images or stylesheets.",
  "Keep the whole file under 40 KB.",
].join(" ");

const PROMPT =
  "Draw a hamster running on a wheel. The hamster should clearly be running and the wheel should turn. Make it charming.";

export const HAMSTER_JUDGE_RUBRIC = [
  "Judge this HTML file as an animated drawing of a hamster running on a wheel, reading the code to picture the result.",
  "5: unmistakably a hamster on a wheel, legs and wheel both animate, composed and charming.",
  "4: clearly a hamster on a turning wheel with minor flaws.",
  "3: recognisable but static in places or crudely drawn.",
  "2: one of the hamster or the wheel is unclear or nothing really runs.",
  "1: does not depict the scene.",
].join("\n");

export const hamsterWheel = defineBenchmark<number, HamsterAnswer>({
  summary: {
    id: "hamster-wheel",
    version: 1,
    name: "Hamster Wheel",
    tagline: "Draw a hamster on a wheel. Make it run",
    description:
      "One prompt, one self-contained HTML file, three attempts per model. People vote blind on pairs, and the hamsters that charm the most climb the board.",
    method:
      "Each model gets the same prompt three times. Files must stay under 40 KB, draw with SVG or canvas, animate, and load nothing from the network, or they score zero. Signed-in visitors vote on blind pairs and a Bradley–Terry fit turns votes into ratings. Until votes arrive, a fixed judge model's reading of the code orders the board.",
    category: "Creative",
    scoring: "votes",
    input: "text",
    artefact: "html",
    playable: false,
    decisionModels: false,
    itemsPerPlay: SAMPLES,
    scoreScale: 100,
    scoreUnit: "/ 100 judge",
    metrics: [{ key: "gatePassRate", label: "Passed the checks", format: "percent" }],
    credit: null,
  },
  items: Array.from({ length: SAMPLES }, (_, index) => ({
    id: `attempt-${index + 1}`,
    truth: index + 1,
  })),
  answerSchema,
  prompt: () => ({ system: SYSTEM, user: PROMPT, imageItemId: null }),
  parse: (output) => {
    const html = extractHtmlDocument(output);

    return html ? { html } : null;
  },
  score: (_item, answer) => gateScore(checkHtmlArtefact(answer.html).reasons),
  artefact: (answer) => ({ kind: "html", content: answer.html }),
  reveal: (item) => ({ attempt: item.truth }),
  metrics: (results) => ({
    gatePassRate:
      results.length === 0
        ? 0
        : results.filter((result) => result.detail.gate === true).length / results.length,
  }),
  judgeRubric: HAMSTER_JUDGE_RUBRIC,
});
