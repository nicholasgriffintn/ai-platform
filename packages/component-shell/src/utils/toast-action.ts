import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { toast } from "sonner";

export async function runWithToast<T>(
  success: string | ((result: T) => string),
  work: () => Promise<T>,
  failure = "That did not work",
): Promise<T | undefined> {
  try {
    const result = await work();

    toast.success(typeof success === "string" ? success : success(result));

    return result;
  } catch (error) {
    toast.error(getErrorMessage(error, failure));

    return undefined;
  }
}
