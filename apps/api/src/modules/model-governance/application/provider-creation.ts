const PROVIDER_CREATION_TIMEOUT_MS = 30 * 60 * 1000;

export function assertProviderCreationPending(startedAt: string | null): void {
  if (startedAt && Date.now() - new Date(startedAt).getTime() >= PROVIDER_CREATION_TIMEOUT_MS) {
    throw new Error(
      "Provider creation did not record a resource identifier. Check the provider account and reconcile the existing resource before retrying; it may already be running.",
    );
  }
}
