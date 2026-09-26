import { TrainingRunList } from "@ngriffin_uk/polychat-component-models";
import { Button, CardSkeleton } from "@ngriffin_uk/polychat-component-ui";
import { useTrainingRuns } from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";

import { TrainDialog } from "../flows/TrainDialog.js";
import { useModelsScope } from "../ModelsScope.js";
import { ModelsSection } from "../ModelsSection.js";

export function TrainingPlace() {
  const { workspaceId, projectId, open, can } = useModelsScope();
  const runs = useTrainingRuns(workspaceId, projectId);
  const [training, setTraining] = useState(false);

  return (
    <>
      <ModelsSection
        title="Training runs"
        description="Fine-tunes, preference and reinforcement runs, distillation, merges and quantisations on the trainers you connect."
        actions={
          can("train") && (
            <Button size="sm" variant="secondary" onClick={() => setTraining(true)}>
              Train a model
            </Button>
          )
        }
      >
        {runs.isLoading ? (
          <CardSkeleton />
        ) : (
          <TrainingRunList runs={runs.data ?? []} onOpen={(run) => open("runs", run.id)} />
        )}
      </ModelsSection>
      <TrainDialog open={training} onOpenChange={setTraining} />
    </>
  );
}
