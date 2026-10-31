import { useEffect, useState } from "react";

export function useLingeringValue<T>(value: T | null, durationMs: number): T | null {
  const [lingering, setLingering] = useState<T | null>(value);

  if (value !== null && value !== lingering) {
    setLingering(value);
  }

  useEffect(() => {
    if (value !== null || lingering === null) {
      return undefined;
    }

    const timer = setTimeout(() => setLingering(null), durationMs);

    return () => clearTimeout(timer);
  }, [durationMs, lingering, value]);

  return value ?? lingering;
}
