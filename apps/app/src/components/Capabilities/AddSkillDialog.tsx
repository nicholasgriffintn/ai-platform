import { FormDialog, Label, Textarea } from "@ngriffin_uk/polychat-component-ui";
import { useState } from "react";

import { useAddSkill } from "~/hooks/useSkills";

const INITIAL_SKILL = `---
name: my-skill
description: Describe when this skill should be used.
---

# Instructions

Describe what the assistant should do.
`;

interface AddSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
}

export function AddSkillDialog({ open, onOpenChange, projectId }: AddSkillDialogProps) {
  const [content, setContent] = useState(INITIAL_SKILL);
  const addSkill = useAddSkill(projectId);

  const close = () => {
    addSkill.reset();
    setContent(INITIAL_SKILL);
    onOpenChange(false);
  };

  const submit = async () => {
    await addSkill.mutateAsync(content);
    close();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !addSkill.isPending) {
          close();
        }
      }}
      title="Add skill"
      description="Add an Agent Skills-compatible SKILL.md document."
      onSubmit={submit}
      submitText="Add skill"
      isLoading={addSkill.isPending}
      submitDisabled={!content.trim()}
    >
      <div className="space-y-2">
        <Label htmlFor="skill-document">SKILL.md</Label>
        <Textarea
          id="skill-document"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={14}
          className="font-mono text-sm"
        />
      </div>
      {addSkill.error && (
        <p role="alert" className="text-sm text-failure">
          {addSkill.error.message}
        </p>
      )}
    </FormDialog>
  );
}
