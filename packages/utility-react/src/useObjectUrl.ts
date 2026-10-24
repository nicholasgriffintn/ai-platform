import { useEffect, useState } from "react";

export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);

      return undefined;
    }

    const next = URL.createObjectURL(blob);

    setUrl(next);

    return () => URL.revokeObjectURL(next);
  }, [blob]);

  return url;
}
