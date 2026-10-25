import { useEffect, useState } from "react";

export function useRunningSeconds(running: boolean, resetKey: string): number {
  const [count, setCount] = useState({ key: resetKey, seconds: 0 });

  if (count.key !== resetKey) {
    setCount({ key: resetKey, seconds: 0 });
  }

  useEffect(() => {
    if (!running) {
      return undefined;
    }

    const timer = setInterval(
      () => setCount((current) => ({ ...current, seconds: current.seconds + 1 })),
      1000,
    );

    return () => clearInterval(timer);
  }, [running]);

  return count.key === resetKey ? count.seconds : 0;
}
