import {
  type Adaptation,
  type DatasetShape,
  type TrainingHyperparameters,
  type TrainingMethod,
  trainingHyperparametersSchema,
} from "@ngriffin_uk/polychat-schemas";
import { formatParameterCount } from "@ngriffin_uk/polychat-utility-core";

const SHAPE_METHODS: Partial<Record<DatasetShape, TrainingMethod>> = {
  preference: "dpo",
  prompt_grader: "rft",
  retrieval: "embedding",
  text: "continued_pretraining",
  image_text: "vision_sft",
};

const GOAL_HINTS: Array<[RegExp, TrainingMethod]> = [
  [/\b(distil|smaller|cheaper|faster|compress)/i, "distillation"],
  [/\b(prefer|tone|style|less like|more like|refus)/i, "dpo"],
  [/\b(extract|json|sql|classif|correct answer|math|reason|grade|verif)/i, "rft"],
  [/\b(retriev|search|embedding|rag|rerank)/i, "embedding"],
  [/\b(vocabulary|jargon|domain text|pretrain)/i, "continued_pretraining"],
];

export interface RecommendationBase {
  versionId: string;
  name: string;
  parameterCount: number | null;
}

export interface TrainingRecommendationDraft {
  method: TrainingMethod;
  adaptation: Adaptation;
  base: RecommendationBase | null;
  hyperparameters: TrainingHyperparameters;
  reasons: string[];
}

function pickMethod(
  goal: string,
  shape: DatasetShape | null,
  hasGrader: boolean,
): [TrainingMethod, string] {
  if (shape && SHAPE_METHODS[shape]) {
    const method = SHAPE_METHODS[shape];

    if (method !== "rft" || hasGrader) {
      return [
        method,
        `Your dataset is ${shape.replace(/_/g, " ")}, which suits ${method.replace(/_/g, " ")}`,
      ];
    }
  }

  const hinted = GOAL_HINTS.find(
    ([pattern, method]) => pattern.test(goal) && (method !== "rft" || hasGrader),
  );

  if (hinted) {
    return [hinted[1], `Your goal reads like a job for ${hinted[1].replace(/_/g, " ")}`];
  }

  return ["sft", "Supervised fine-tuning on good examples is the safest first step"];
}

function pickBase(
  method: TrainingMethod,
  bases: readonly RecommendationBase[],
): RecommendationBase | null {
  const sized = bases.filter((base) => base.parameterCount !== null);
  const ceiling = method === "distillation" ? 8.5e9 : method === "embedding" ? 1e9 : 14.5e9;
  const floor = method === "embedding" ? 0 : 1e9;
  const inRange = sized
    .filter((base) => (base.parameterCount ?? 0) <= ceiling && (base.parameterCount ?? 0) >= floor)
    .sort((left, right) => (right.parameterCount ?? 0) - (left.parameterCount ?? 0));

  return (
    inRange[0] ??
    sized.sort((left, right) => (left.parameterCount ?? 0) - (right.parameterCount ?? 0))[0] ??
    bases[0] ??
    null
  );
}

export function recommendTraining({
  goal,
  shape,
  rows,
  hasGrader,
  bases,
}: {
  goal: string;
  shape: DatasetShape | null;
  rows: number;
  hasGrader: boolean;
  bases: readonly RecommendationBase[];
}): TrainingRecommendationDraft {
  const [method, methodReason] = pickMethod(goal, shape, hasGrader);
  const base = pickBase(method, bases);
  const parameters = base?.parameterCount ?? null;
  const adaptation: Adaptation =
    method === "embedding" || (parameters !== null && parameters <= 3e9 && rows > 20_000)
      ? "full"
      : parameters !== null && parameters > 30e9
        ? "qlora"
        : "lora";
  const epochs = rows < 1000 ? 3 : rows < 10_000 ? 2 : 1;
  const reasons = [methodReason];

  if (base) {
    reasons.push(
      `${base.name} (${parameters === null ? "unknown size" : formatParameterCount(parameters)}) is the largest approved base that trains cheaply`,
    );
  } else {
    reasons.push("No approved base model yet; import and approve one first");
  }

  reasons.push(
    adaptation === "full"
      ? "The model is small enough that training every weight is affordable"
      : adaptation === "qlora"
        ? "A 4-bit base keeps a large model inside one GPU"
        : "A LoRA adapter trains quickly and can share a GPU with other adapters",
  );

  if (rows > 0) {
    reasons.push(
      `${epochs} epoch${epochs === 1 ? "" : "s"} suits ${rows.toLocaleString("en-GB")} examples`,
    );
  }

  return {
    method,
    adaptation,
    base,
    hyperparameters: trainingHyperparametersSchema.parse({
      epochs,
      loraRank: rows > 20_000 ? 32 : 16,
      loraAlpha: rows > 20_000 ? 64 : 32,
    }),
    reasons,
  };
}
