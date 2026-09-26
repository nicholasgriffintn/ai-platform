import { DatasetList } from "@ngriffin_uk/polychat-component-models";
import { Button, CardSkeleton } from "@ngriffin_uk/polychat-component-ui";
import { useDatasets } from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";

import { CreateDatasetDialog } from "../flows/CreateDatasetDialog.js";
import { useModelsScope } from "../ModelsScope.js";
import { ModelsSection } from "../ModelsSection.js";

export function DatasetsPlace() {
  const { workspaceId, projectId, open, can } = useModelsScope();
  const datasets = useDatasets(workspaceId, projectId);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <ModelsSection
        title="Datasets"
        description="Governed, versioned training data. Licence, lawful basis and personal data are recorded before a row is used."
        actions={
          can("build_datasets") && (
            <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
              New dataset
            </Button>
          )
        }
      >
        {datasets.isLoading ? (
          <CardSkeleton />
        ) : (
          <DatasetList
            datasets={datasets.data ?? []}
            onOpen={(dataset) => open("datasets", dataset.versionId)}
          />
        )}
      </ModelsSection>
      <CreateDatasetDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
