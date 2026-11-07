import type {
  CitizenView,
  Moment,
  MonthlyMetrics,
  TimelineMark,
  WorldSnapshot,
} from "@ngriffin_uk/polychat-library-polis";
import type {
  PolisBucket,
  PolisBucketAnswer,
  PolisLaw,
  PolisParameters,
  PolisRecording,
  PolisScenario,
} from "@ngriffin_uk/polychat-schemas";

export const POLIS_SPEEDS = [
  { label: "Slow", daysPerSecond: 1 / 120 },
  { label: "Walk", daysPerSecond: 1 / 30 },
  { label: "Run", daysPerSecond: 1 },
  { label: "Fly", daysPerSecond: 12 },
  { label: "Years", daysPerSecond: 180 },
] as const;

export const POLIS_MAP_MODES = ["town", "mood", "wealth", "rent"] as const;
export type PolisMapMode = (typeof POLIS_MAP_MODES)[number];

export const POLIS_MODEL_BUDGETS = [0, 250, 1000, 5000, Infinity] as const;

export type PolisExportPurpose = "download" | "share";

export const POLIS_PLAYBACK_UNITS = ["hours", "days", "months", "years"] as const;
export type PolisPlaybackUnit = (typeof POLIS_PLAYBACK_UNITS)[number];

export interface PolisModelSettings {
  callsPerYear: number;
  holdForAnswers: boolean;
  model?: string;
}

export type PolisCommand =
  | { type: "canvas"; canvas: OffscreenCanvas; width: number; height: number; pixelRatio: number }
  | { type: "resize"; width: number; height: number; pixelRatio: number }
  | { type: "create"; population: number; seed: number; name?: string }
  | { type: "open"; id: string; watch: boolean }
  | { type: "import"; recording: PolisRecording; watch: boolean }
  | { type: "forget"; id: string }
  | { type: "save" }
  | { type: "export"; purpose: PolisExportPurpose }
  | { type: "watch" }
  | { type: "backToNow" }
  | { type: "carryOn" }
  | { type: "seek"; day: number; hour?: number }
  | { type: "nudge"; unit: PolisPlaybackUnit; direction: 1 | -1 }
  | { type: "playback"; playing: boolean; unit: PolisPlaybackUnit }
  | { type: "running"; running: boolean }
  | { type: "speed"; index: number }
  | { type: "step"; days: number }
  | { type: "parameters"; values: Partial<PolisParameters> }
  | { type: "law"; law: PolisLaw }
  | { type: "repeal"; id: number }
  | { type: "scenario"; scenario: PolisScenario }
  | { type: "fork" }
  | { type: "branch"; index: number }
  | { type: "keepBranch" }
  | { type: "model"; settings: PolisModelSettings }
  | {
      type: "answers";
      requestId: number;
      answers: PolisBucketAnswer[];
      failedKeys: number[];
      tokens: number;
      model: string | null;
      error?: string;
    }
  | { type: "poll"; requestId: number }
  | { type: "pan"; dx: number; dy: number }
  | { type: "zoom"; factor: number; x: number; y: number }
  | { type: "mapMode"; mode: PolisMapMode }
  | { type: "click"; x: number; y: number }
  | { type: "follow"; person: number }
  | { type: "followRandom" }
  | { type: "focusFollowed" };

export interface PolisSeries {
  label: string;
  points: MonthlyMetrics[];
}

export interface PolisDecisionStats {
  calls: number;
  tokens: number;
  callsThisYear: number;
  model: string | null;
  error: string | null;
  recent: { label: string; action: string; probability: number }[];
}

export interface PolisPlaybackState {
  day: number;
  hour: number;
  endDay: number;
  playing: boolean;
  unit: PolisPlaybackUnit;
  seeking: boolean;
}

export interface PolisStatus {
  snapshot: WorldSnapshot;
  running: boolean;
  speedIndex: number;
  branch: number;
  branches: string[];
  series: PolisSeries[];
  decisions: PolisDecisionStats;
  citizen: CitizenView | null;
  daysPerSecond: number;
  playback: PolisPlaybackState | null;
  hour: number;
  marks: TimelineMark[];
  moments: Moment[];
}

export type PolisRecordingSummary = Omit<PolisRecording, "log">;

export type PolisEvent =
  | { type: "ready"; recordings: PolisRecordingSummary[] }
  | { type: "recordings"; recordings: PolisRecordingSummary[] }
  | { type: "restoring"; name: string; day: number; endDay: number }
  | { type: "recording"; recording: PolisRecording; purpose: PolisExportPurpose }
  | { type: "status"; status: PolisStatus }
  | { type: "decide"; requestId: number; buckets: PolisBucket[]; laws: string[]; model?: string }
  | {
      type: "pollBuckets";
      requestId: number;
      buckets: { bucket: PolisBucket; people: number }[];
      laws: string[];
      model?: string;
    };
