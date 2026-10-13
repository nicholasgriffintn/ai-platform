import type {
  BenchmarkArtefact,
  BenchmarkItemPublic,
  BenchmarkSummary,
  DecisionQuestions,
} from "@ngriffin_uk/polychat-schemas";
import type z from "zod/v4";

export type ItemDetail = Record<string, string | number | boolean>;

export interface ItemScore {
  score: number;
  detail: ItemDetail;
}

export interface BenchmarkPrompt {
  system: string;
  user: string;
  imageItemId: string | null;
}

export interface DecisionPrompt {
  state: Record<string, string>;
  questions: DecisionQuestions;
  answerKey: string;
}

export interface BenchmarkItem<TTruth> {
  id: string;
  truth: TTruth;
}

export interface ScoredAnswer<TAnswer> {
  itemId: string;
  answer: TAnswer | null;
  score: number | null;
  detail: ItemDetail;
}

export interface BenchmarkDefinition<TTruth, TAnswer> {
  summary: Omit<BenchmarkSummary, "itemCount">;
  items: readonly BenchmarkItem<TTruth>[];
  answerSchema: z.ZodType<TAnswer>;
  prompt: (item: BenchmarkItem<TTruth>) => BenchmarkPrompt;
  parse: (output: string) => unknown;
  score: (item: BenchmarkItem<TTruth>, answer: TAnswer) => ItemScore;
  publicData?: (item: BenchmarkItem<TTruth>) => Record<string, unknown>;
  reveal: (item: BenchmarkItem<TTruth>) => Record<string, unknown>;
  metrics?: (results: readonly ScoredAnswer<TAnswer>[]) => Record<string, number>;
  decision?: (item: BenchmarkItem<TTruth>) => DecisionPrompt;
  fromDecision?: (probability: number) => TAnswer;
  artefact?: (answer: TAnswer) => BenchmarkArtefact;
  judgeRubric?: string;
}

export interface Benchmark {
  summary: BenchmarkSummary;
  itemIds: readonly string[];
  judgeRubric: string | null;
  hasItem: (itemId: string) => boolean;
  prompt: (itemId: string) => BenchmarkPrompt;
  decision: (itemId: string) => DecisionPrompt | null;
  fromDecision: (probability: number) => unknown;
  parseOutput: (output: string) => unknown;
  validateAnswer: (value: unknown) => unknown;
  score: (itemId: string, answer: unknown) => ItemScore;
  artefact: (itemId: string, answer: unknown) => BenchmarkArtefact | null;
  publicItem: (itemId: string) => BenchmarkItemPublic;
  reveal: (itemId: string) => Record<string, unknown>;
  metrics: (results: readonly ScoredAnswer<unknown>[]) => Record<string, number>;
}
