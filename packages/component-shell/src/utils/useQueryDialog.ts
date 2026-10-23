import { useSearchParamsPatch } from "./useSearchParamsPatch.js";

export function useQueryDialog(parameter: string): [boolean, (open: boolean) => void] {
  const [searchParams, patch] = useSearchParamsPatch();
  const setOpen = (open: boolean) => patch({ [parameter]: open ? "1" : null });

  return [searchParams.get(parameter) === "1", setOpen];
}
