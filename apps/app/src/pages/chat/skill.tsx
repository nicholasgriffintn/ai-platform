import { useParams } from "react-router";

import { SkillEditorPage } from "~/components/Capabilities/SkillEditor/SkillEditorPage";

export function meta() {
  return [{ title: "Edit skill - Polychat" }];
}

export default function PersonalSkillPage() {
  const { skillId = "" } = useParams();

  return (
    <SkillEditorPage
      skillId={skillId}
      backPath="/chat/capabilities"
      backLabel="Back to capabilities"
    />
  );
}
