import { useCallback, useEffect, useRef, useState } from "react";

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
