import { toast } from "sonner";

export class DesktopFeatureUnavailableError extends Error {
  readonly feature: string;

  constructor(feature: string) {
    super(`${feature} has not been migrated to the Polychat desktop app yet.`);
    this.name = "DesktopFeatureUnavailableError";
    this.feature = feature;
  }
}

export function unavailableOnDesktop(feature: string): () => never {
  return () => {
    const error = new DesktopFeatureUnavailableError(feature);

    toast.error(error.message);

    throw error;
  };
}
