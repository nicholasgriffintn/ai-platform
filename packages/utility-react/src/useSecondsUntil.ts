import { useEffect, useState } from "react";

function secondsUntil(deadline: string): number {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
}

export function useSecondsUntil(deadline: string): number {
  const [seconds, setSeconds] = useState(() => secondsUntil(deadline));

  useEffect(() => {
    const timer = setInterval(() => setSeconds(secondsUntil(deadline)), 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  return seconds;
}
