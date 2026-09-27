import { useSearchParams } from "react-router";

export function useQueryDialog(parameter: string): [boolean, (open: boolean) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const setOpen = (open: boolean) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (open) {
          next.set(parameter, "1");
        } else {
          next.delete(parameter);
        }

        return next;
      },
      { replace: true },
    );
  };

  return [searchParams.get(parameter) === "1", setOpen];
}
