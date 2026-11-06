import type {
  ModelConfigItem,
  ModelDataLocation,
  ModelDataRegion,
  ModelDataRetention,
  ModelZeroRetention,
} from "./models.js";

export function formatTokenCount(value?: number) {
  if (!value) {
    return null;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }

  return String(value);
}

export function formatTokenPrice(value?: number) {
  if (typeof value !== "number") {
    return null;
  }

  if (value === 0) {
    return "$0 / 1K tokens";
  }

  if (value < 0.01) {
    return `$${value.toFixed(4)} / 1K tokens`;
  }

  return `$${value.toFixed(2)} / 1K tokens`;
}

const ZERO_RETENTION_NOTES: Record<ModelZeroRetention, string> = {
  default: "Nothing is kept by default.",
  account_setting: "Zero retention depends on how the provider account is configured.",
  on_request: "Zero retention is available by agreement with the provider.",
};

export function describeModelDataRetention(retention: ModelDataRetention): string {
  const days = retention.maxDays;
  const kept =
    days === "unknown"
      ? "The provider does not document how long it keeps prompts and replies."
      : days === 0
        ? "The provider does not keep prompts or replies."
        : `The provider may keep prompts and replies for up to ${days} ${days === 1 ? "day" : "days"}.`;
  const zero = retention.zeroRetention ? ZERO_RETENTION_NOTES[retention.zeroRetention] : null;

  return zero ? `${kept} ${zero}` : kept;
}

const DATA_REGION_LABELS: Record<ModelDataRegion, string> = {
  us: "US",
  eu: "EU",
  sg: "Singapore",
  cn: "China",
};

const DATA_LOCATION_LABELS: Record<
  Exclude<ModelDataLocation["kind"], "regions">,
  Pick<ModelDataLocationLabel, "short" | "detail">
> = {
  multiple: {
    short: "Multiple regions",
    detail: "The provider may process this data in more than one country.",
  },
  deployment: {
    short: "Set per deployment",
    detail: "Location depends on the region set for this provider's deployment.",
  },
  routed: {
    short: "Depends on route",
    detail: "This service forwards requests, so location depends on the host that serves them.",
  },
  unknown: {
    short: "Location unknown",
    detail: "The provider does not document where it processes this data.",
  },
};

export interface ModelDataLocationLabel {
  short: string;
  detail: string;
  source?: string;
}

export function getModelDataLocationLabel(
  model: Pick<ModelConfigItem, "dataLocation" | "machineId" | "runsOn">,
): ModelDataLocationLabel {
  if (model.runsOn === "device") {
    return { short: "On this device", detail: "This model runs on your device." };
  }

  if (model.machineId) {
    return { short: "Your machine", detail: "This model runs on a machine you connected." };
  }

  const location = model.dataLocation;

  if (!location) {
    return DATA_LOCATION_LABELS.unknown;
  }

  if (location.kind !== "regions") {
    return { ...DATA_LOCATION_LABELS[location.kind], source: location.source };
  }

  const regions = location.regions.map((region) => DATA_REGION_LABELS[region]).join(" and ");

  return {
    short: regions,
    detail: `The provider documents this data as hosted in: ${regions}.`,
    source: location.source,
  };
}
