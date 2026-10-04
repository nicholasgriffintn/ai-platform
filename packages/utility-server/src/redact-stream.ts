export function redactTextStream(
  stream: ReadableStream<Uint8Array>,
  values: string[],
): ReadableStream<Uint8Array> {
  const secrets = [...new Set(values.filter(Boolean))];

  if (secrets.length === 0) {
    return stream;
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const retainedLength = Math.max(...secrets.map((secret) => secret.length)) - 1;
  let buffer = "";
  const drain = (final: boolean): string => {
    let output = "";
    let limit = final ? buffer.length : Math.max(0, buffer.length - retainedLength);

    while (limit > 0) {
      let matchIndex = buffer.length;
      let matchLength = 0;

      for (const secret of secrets) {
        const index = buffer.indexOf(secret);

        if (
          index >= 0 &&
          (index < matchIndex || (index === matchIndex && secret.length > matchLength))
        ) {
          matchIndex = index;
          matchLength = secret.length;
        }
      }

      if (matchIndex >= limit) {
        if (limit < buffer.length && (buffer.codePointAt(limit - 1) ?? 0) > 0xffff) {
          limit -= 1;
        }

        output += buffer.slice(0, limit);
        buffer = buffer.slice(limit);
        break;
      }

      output += buffer.slice(0, matchIndex) + "[REDACTED]";
      buffer = buffer.slice(matchIndex + matchLength);
      limit = final ? buffer.length : Math.max(0, buffer.length - retainedLength);
    }

    return output;
  };

  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const safe = drain(false);

        if (safe) {
          controller.enqueue(encoder.encode(safe));
        }
      },
      flush(controller) {
        buffer += decoder.decode();
        const safe = drain(true);

        if (safe) {
          controller.enqueue(encoder.encode(safe));
        }
      },
    }),
  );
}
