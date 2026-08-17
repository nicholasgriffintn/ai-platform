import { MemorySynthesisPanel as ControlledMemorySynthesisPanel } from "@ngriffin_uk/polychat-component-account";
import { toast } from "sonner";

import { useMemorySynthesis, useTasks } from "~/hooks/useTasks";

export function MemorySynthesisPanel() {
	const { synthesis, history, isLoadingSynthesis, isLoadingHistory } = useMemorySynthesis("global");
	const { triggerSynthesisAsync, isTriggeringSynthesis } = useTasks({ shouldRefetch: false });

	return (
		<ControlledMemorySynthesisPanel
			synthesis={synthesis}
			previousSyntheses={history.filter((item) => item.id !== synthesis?.id)}
			isLoadingSynthesis={isLoadingSynthesis}
			isLoadingHistory={isLoadingHistory}
			isGenerating={isTriggeringSynthesis}
			onGenerate={async () => {
				try {
					await triggerSynthesisAsync({ namespace: "global" });
					toast.success("Memory synthesis queued");
				} catch (error) {
					toast.error(error instanceof Error ? error.message : "Could not queue memory synthesis");
				}
			}}
		/>
	);
}
