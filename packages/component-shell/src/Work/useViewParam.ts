import { useSearchParams } from "react-router";

export function useViewParam<T extends string>(
  read: (value: string | null) => T,
  defaultView: T,
): [T, (view: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const setView = (next: T) => {
    const params = new URLSearchParams(searchParams);

    if (next === defaultView) {
      params.delete("view");
    } else {
      params.set("view", next);
    }

    setSearchParams(params, { replace: true });
  };

  return [read(searchParams.get("view")), setView];
}
