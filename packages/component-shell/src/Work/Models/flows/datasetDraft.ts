import type {
  CreateDatasetRequest,
  DatasetMapping,
  LawfulBasis,
} from "@ngriffin_uk/polychat-schemas";

export type DatasetSource = CreateDatasetRequest["source"];

export interface DatasetDraft {
  source: DatasetSource;
  name: string;
  uploadId: string | null;
  mapping: DatasetMapping | null;
  repo: string;
  hubConfig: string;
  hubSplit: string;
  uri: string;
  minRating: number;
  preference: boolean;
  teacherRouteId: string;
  sampleCount: number;
  seedPrompts: string;
  instructions: string;
  licence: string;
  lawfulBasis: LawfulBasis;
  personalData: string;
  customerData: boolean;
  intendedUse: string;
  redactPii: boolean;
  dedupe: boolean;
  decontaminateSuiteIds: string[];
  validationPercent: number;
}

export const EMPTY_DATASET_DRAFT: DatasetDraft = {
  source: "upload",
  name: "",
  uploadId: null,
  mapping: null,
  repo: "",
  hubConfig: "",
  hubSplit: "train",
  uri: "",
  minRating: 4,
  preference: false,
  teacherRouteId: "",
  sampleCount: 500,
  seedPrompts: "",
  instructions: "",
  licence: "",
  lawfulBasis: "not_personal_data",
  personalData: "",
  customerData: false,
  intendedUse: "",
  redactPii: true,
  dedupe: true,
  decontaminateSuiteIds: [],
  validationPercent: 5,
};

const AUTO_MAPPING: DatasetMapping = { shape: "messages", columns: {} };

function seedPrompts(draft: DatasetDraft): string[] {
  return draft.seedPrompts
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function datasetDraftProblem(draft: DatasetDraft): string | null {
  if (!draft.name.trim()) {
    return "Name the dataset";
  }

  if (!draft.licence.trim()) {
    return "Record the licence";
  }

  switch (draft.source) {
    case "upload":
      return draft.uploadId ? null : "Upload a file first";
    case "hub":
      return /^[\w.-]+\/[\w.-]+$/.test(draft.repo) ? null : "Use the owner/name form";
    case "bucket":
      return draft.uri.startsWith("s3://") ? null : "Use an s3:// URI";
    case "conversations":
      return null;
    default:
      return !draft.teacherRouteId
        ? "Pick a teacher"
        : seedPrompts(draft).length === 0
          ? "Add seed prompts"
          : null;
  }
}

export function buildDatasetRequest(
  draft: DatasetDraft,
  projectId: string | null,
): CreateDatasetRequest {
  const common = {
    projectId,
    name: draft.name.trim(),
    mapping:
      draft.source === "conversations"
        ? { shape: draft.preference ? ("preference" as const) : ("messages" as const), columns: {} }
        : (draft.mapping ?? AUTO_MAPPING),
    governance: {
      licence: draft.licence.trim(),
      lawfulBasis: draft.lawfulBasis,
      personalDataCategories: draft.personalData
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      containsCustomerData: draft.customerData,
      intendedUse: draft.intendedUse,
    },
    split: { validation: draft.validationPercent / 100 },
    processing: {
      redactPii: draft.redactPii,
      dedupe: draft.dedupe,
      decontaminateSuiteIds: draft.decontaminateSuiteIds,
    },
  };

  switch (draft.source) {
    case "upload":
      return { ...common, source: "upload", uploadId: draft.uploadId ?? "" };
    case "hub":
      return {
        ...common,
        source: "hub",
        repo: draft.repo.trim(),
        hubSplit: draft.hubSplit || "train",
        ...(draft.hubConfig ? { config: draft.hubConfig } : {}),
      };
    case "bucket":
      return { ...common, source: "bucket", provider: "aws", uri: draft.uri.trim() };
    case "conversations":
      return {
        ...common,
        source: "conversations",
        filters: { minFeedbackRating: draft.minRating },
      };
    default:
      return {
        ...common,
        source: "synthetic",
        teacher: { routeId: draft.teacherRouteId, sampleCount: draft.sampleCount },
        seedPrompts: seedPrompts(draft),
        instructions: draft.instructions,
      };
  }
}
