import type { ToolInteractionHandler } from "@ngriffin_uk/polychat-component-content";
import { useToolRules } from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useCallback } from "react";
import { toast } from "sonner";

type InteractionData = Parameters<ToolInteractionHandler>[2];

export function useApprovalRules() {
  const { setRule } = useToolRules();

  return useCallback(
    async (toolName: string, data: InteractionData): Promise<InteractionData> => {
      const { rule, ...rest } = data;

      if (rule !== "act" && rule !== "hand_off") {
        return data;
      }

      try {
        await setRule(toolName, rule);
        toast.success(
          rule === "act"
            ? `${toolName} will run without asking from now on`
            : `${toolName} is left to you from now on`,
        );
      } catch (error) {
        toast.error(getErrorMessage(error, "That rule could not be saved"));
      }

      return rest;
    },
    [setRule],
  );
}
