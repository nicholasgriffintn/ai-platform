import { MemorySynthesisPanel as ControlledMemorySynthesisPanel } from "@ngriffin_uk/polychat-component-account";
import { useMemorySynthesis, useTasks } from "@ngriffin_uk/polychat-library-react";
import { toast } from "sonner";

export function MemorySynthesisPanel() {
  const { synthesis, history, isLoadingSynthesis, isLoadingHistory } = useMemorySynthesis("global");
  const { triggerSynthesisAsync, isTriggeringSynthesis } = useTasks({ shouldRefetch: false });

  const generateSynthesis = async () => {
    try {
      await triggerSynthesisAsync({ namespace: "global" });
      toast.success("Memory synthesis queued");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not queue memory synthesis");
    }
  };

  return (
    <ControlledMemorySynthesisPanel
      synthesis={synthesis}
      previousSyntheses={history.filter((item) => item.id !== synthesis?.id)}
      isLoadingSynthesis={isLoadingSynthesis}
      isLoadingHistory={isLoadingHistory}
      isGenerating={isTriggeringSynthesis}
      onGenerate={() => void generateSynthesis()}
    />
  );
}
