import { useCallback, useLayoutEffect, useRef } from "react";

export function useStableCallback<TArguments extends unknown[], TResult>(
  callback: (...args: TArguments) => TResult,
): (...args: TArguments) => TResult {
  const latest = useRef(callback);

  useLayoutEffect(() => {
    latest.current = callback;
  });

  return useCallback((...args: TArguments) => latest.current(...args), []);
}
