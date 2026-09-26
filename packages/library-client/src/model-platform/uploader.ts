import type { UploadPurpose, UploadSession } from "@ngriffin_uk/polychat-schemas";
import { delay } from "@ngriffin_uk/polychat-utility-core";

import {
  completeModelUpload,
  createModelUpload,
  getModelUpload,
  uploadModelPart,
} from "./registry.js";

const PART_CONCURRENCY = 3;
const HASH_POLL_MS = 3_000;

export interface UploadSource {
  path: string;
  file: Blob;
}

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
}

interface PendingPart {
  fileIndex: number;
  partNumber: number;
  bytes: Blob;
}

function pendingParts(session: UploadSession, sources: readonly UploadSource[]): PendingPart[] {
  return session.files.flatMap((file) => {
    const source = sources.find((item) => item.path === file.path);

    if (!source) {
      throw new Error(`${file.path} is missing from the selected files`);
    }

    const uploaded = new Set(file.partsUploaded);

    return Array.from({ length: file.partCount }, (_, index) => index + 1)
      .filter((partNumber) => !uploaded.has(partNumber))
      .map((partNumber) => ({
        fileIndex: file.index,
        partNumber,
        bytes: source.file.slice(
          (partNumber - 1) * session.partBytes,
          partNumber * session.partBytes,
        ),
      }));
  });
}

function uploadedBytes(session: UploadSession): number {
  return session.files.reduce(
    (total, file) =>
      total +
      file.partsUploaded.reduce(
        (sum, partNumber) =>
          sum + Math.min(session.partBytes, file.size - (partNumber - 1) * session.partBytes),
        0,
      ),
    0,
  );
}

export async function uploadModelFiles(input: {
  workspaceId: string;
  purpose: UploadPurpose;
  name: string;
  sources: readonly UploadSource[];
  resumeUploadId?: string;
  onProgress?: (progress: UploadProgress) => void;
  onSession?: (session: UploadSession) => void;
  signal?: AbortSignal;
}): Promise<UploadSession> {
  const session = input.resumeUploadId
    ? await getModelUpload(input.workspaceId, input.resumeUploadId)
    : await createModelUpload(input.workspaceId, {
        purpose: input.purpose,
        name: input.name,
        files: input.sources.map((source) => ({ path: source.path, size: source.file.size })),
      });
  const totalBytes = input.sources.reduce((total, source) => total + source.file.size, 0);
  const queue = pendingParts(session, input.sources);
  let done = uploadedBytes(session);

  input.onProgress?.({ uploadedBytes: done, totalBytes });

  const worker = async () => {
    for (let part = queue.shift(); part; part = queue.shift()) {
      if (input.signal?.aborted) {
        throw new Error("Upload cancelled");
      }

      await uploadModelPart(
        input.workspaceId,
        session.id,
        part.fileIndex,
        part.partNumber,
        part.bytes,
      );
      done += part.bytes.size;
      input.onProgress?.({ uploadedBytes: done, totalBytes });
    }
  };

  await Promise.all(Array.from({ length: PART_CONCURRENCY }, worker));

  let completed = await completeModelUpload(input.workspaceId, session.id);

  input.onSession?.(completed);

  while (completed.status === "hashing") {
    await delay(HASH_POLL_MS, input.signal);
    completed = await getModelUpload(input.workspaceId, session.id);
    input.onSession?.(completed);
  }

  if (completed.status !== "ready") {
    throw new Error(completed.failureReason ?? "The upload could not be verified");
  }

  return completed;
}
