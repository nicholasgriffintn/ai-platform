import { Zip, ZipDeflate, ZipPassThrough } from "fflate";

const MAX_ARCHIVE_NAME_LENGTH = 120;
const FALLBACK_ARCHIVE_NAME = "file";

export interface ZipEntryOptions {
  compress?: boolean;
}

export interface ZipStreamWriter {
  addEntry(
    path: string,
    chunks: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
    options?: ZipEntryOptions,
  ): Promise<void>;
}

export interface ZipStream {
  stream: ReadableStream<Uint8Array>;
  done: Promise<void>;
}

export function toArchiveName(value: string | null | undefined): string {
  const name = (value ?? "")
    .split(/[/\\]/)
    .pop()
    ?.replace(/[\p{Cc}<>:"|?*]/gu, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(-MAX_ARCHIVE_NAME_LENGTH);

  return name || FALLBACK_ARCHIVE_NAME;
}

export function createZipStream(build: (zip: ZipStreamWriter) => Promise<void>): ZipStream {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  let flushed: Promise<void> = Promise.resolve();

  const zip = new Zip((error, chunk, final) => {
    flushed = flushed.then(async () => {
      if (error) {
        throw error;
      }

      await writer.write(chunk);

      if (final) {
        await writer.close();
      }
    });
  });

  const addEntry: ZipStreamWriter["addEntry"] = async (path, chunks, options) => {
    const entry = options?.compress ? new ZipDeflate(path) : new ZipPassThrough(path);

    zip.add(entry);

    for await (const chunk of chunks) {
      entry.push(chunk);
      await flushed;
    }

    entry.push(new Uint8Array(0), true);
    await flushed;
  };

  const done = build({ addEntry })
    .then(async () => {
      zip.end();
      await flushed;
    })
    .catch(async (error: unknown) => {
      zip.terminate();
      await writer.abort(error).catch(() => undefined);
      throw error;
    });

  return { stream: readable, done };
}
