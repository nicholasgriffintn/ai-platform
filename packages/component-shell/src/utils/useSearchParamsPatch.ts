import { useSearchParams } from "react-router";

export type SearchParamsPatch = Partial<Record<string, string | null>>;

export function useSearchParamsPatch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const patch = (values: SearchParamsPatch, { replace = true }: { replace?: boolean } = {}) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        for (const [key, value] of Object.entries(values)) {
          if (value === null || value === undefined) {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        }

        return next;
      },
      { replace },
    );
  };

  return [searchParams, patch] as const;
}
