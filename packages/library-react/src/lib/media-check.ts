import { API_BASE_URL, returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import {
  mediaProvenanceEntrySchema,
  type MediaProvenanceEntry,
} from "@ngriffin_uk/polychat-schemas";
import { sha256HexBytes } from "@ngriffin_uk/polychat-utility-core";

export const MAX_CHECKABLE_BYTES = 256 * 1024 * 1024;

const CHECKABLE_MEDIA_TYPE = /^(?:image|video|audio)\//i;

export type MediaCheckResult =
  | { kind: "found"; entry: MediaProvenanceEntry }
  | { kind: "no-record" }
  | { kind: "too-large" }
  | { kind: "unavailable" };

const FOUND_DETAILS: Record<MediaProvenanceEntry["status"], string> = {
  marked: "We have a record of this exact file, and it carries our AI-generated mark.",
  "provider-marked":
    "We have a record of this exact file, and it keeps the mark from the model provider.",
  "already-marked":
    "We have a record of this exact file, and it already carried a mark when it reached us.",
  unsupported: "We have a record of this exact file. Its format can't hold an embedded mark.",
  "too-large": "We have a record of this exact file. It was too large to embed a mark.",
};

export function isCheckableMedia(mimeType: string | null | undefined): boolean {
  return CHECKABLE_MEDIA_TYPE.test(mimeType ?? "");
}

export function describeMediaCheck(result: MediaCheckResult): { title: string; detail: string } {
  switch (result.kind) {
    case "found":
      return { title: "AI-generated here", detail: FOUND_DETAILS[result.entry.status] };
    case "no-record":
      return {
        title: "No record of this exact file",
        detail:
          "This doesn't tell you whether it's AI-generated. Screenshots, edits and re-saved copies won't match.",
      };
    case "too-large":
      return {
        title: "Too large to check here",
        detail: "Files over 256 MB can't be checked in the browser.",
      };
    case "unavailable":
      return { title: "Couldn't check this file", detail: "Try again in a moment." };
  }
}

async function lookUpFingerprint(fingerprint: string): Promise<MediaCheckResult> {
  const response = await fetch(`${API_BASE_URL}/provenance/${fingerprint}`);

  if (response.status === 404) {
    return { kind: "no-record" };
  }

  if (!response.ok) {
    return { kind: "unavailable" };
  }

  const entry = mediaProvenanceEntrySchema.safeParse(await returnFetchedData<unknown>(response));

  return entry.success ? { kind: "found", entry: entry.data } : { kind: "unavailable" };
}

export async function checkMediaFile(file: Blob): Promise<MediaCheckResult> {
  if (file.size > MAX_CHECKABLE_BYTES) {
    return { kind: "too-large" };
  }

  try {
    return await lookUpFingerprint(await sha256HexBytes(await file.arrayBuffer()));
  } catch {
    return { kind: "unavailable" };
  }
}

export async function checkMediaUrl(url: string): Promise<MediaCheckResult> {
  try {
    const response = await fetch(url, { credentials: "include" });

    if (!response.ok) {
      return { kind: "unavailable" };
    }

    if (Number(response.headers.get("content-length")) > MAX_CHECKABLE_BYTES) {
      void response.body?.cancel();

      return { kind: "too-large" };
    }

    return await checkMediaFile(await response.blob());
  } catch {
    return { kind: "unavailable" };
  }
}
