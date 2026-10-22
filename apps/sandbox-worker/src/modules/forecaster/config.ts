import type { ContainerInstanceType } from "@ngriffin_uk/polychat-schemas";

export const INTERNAL_FORECASTER_ORIGIN = "https://forecaster.internal";
export const FORECASTER_PORT = 8080;
export const FORECASTER_INSTANCE_TYPE = "standard-2" satisfies ContainerInstanceType;
export const FORECASTER_POOL_SIZE = 2;
export const FORECASTER_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
export const FORECASTER_READY_TIMEOUT_MS = 100_000;
export const FORECASTER_REQUEST_TIMEOUT_MS = 50_000;
