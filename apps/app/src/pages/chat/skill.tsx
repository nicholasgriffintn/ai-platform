import { SkillEditorPage } from "@ngriffin_uk/polychat-component-shell";
import { getPlacePaths } from "@ngriffin_uk/polychat-library-react";
import { useParams } from "react-router";

export function meta() {
  return [{ title: "Review a skill - Polychat" }];
}

export default function PersonalSkillPage() {
  const { skillId = "" } = useParams();

  return (
    <SkillEditorPage
      skillId={skillId}
      backPath={getPlacePaths("chat").plugins}
      backLabel="Back to plugins"
    />
  );
}
