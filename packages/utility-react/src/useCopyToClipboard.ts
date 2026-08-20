import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared by the message actions, the code block header and the JSON payload view, so the "Copied"
 * acknowledgement behaves the same wherever a copy control appears.
 */
export const useCopyToClipboard = (timeout = 2000) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  /** Deliberately fire-and-forget: callers are click handlers, which must not return a promise. */
  const copy = useCallback(
    (content: string): void => {
      const write = async () => {
        try {
          await navigator.clipboard.writeText(content);
          setCopied(true);

          if (timerRef.current) {
            clearTimeout(timerRef.current);
          }

          timerRef.current = setTimeout(() => setCopied(false), timeout);
        } catch (error) {
          console.error("Failed to copy content: ", error);
        }
      };

      void write();
    },
    [timeout],
  );

  return { copied, copy };
};
