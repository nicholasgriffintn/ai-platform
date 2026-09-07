import { ContentLoadingSkeleton } from "@ngriffin_uk/polychat-component-ui";
import { lazy, Suspense } from "react";

import { ProfileTab } from "../ProfileTabLayout.js";

const TrainingDashboard = lazy(async () => {
  const module = await import("../../Apps/Training/TrainingDashboard.js");

  return { default: module.TrainingDashboard };
});

export function ProfileTrainingTab() {
  return (
    <ProfileTab
      title="Training"
      description="Train, inspect and deploy models on your own provider credentials. Training belongs to you rather than to a project, so it lives here alongside your other advanced settings."
    >
      <Suspense fallback={<ContentLoadingSkeleton />}>
        <TrainingDashboard />
      </Suspense>
    </ProfileTab>
  );
}
