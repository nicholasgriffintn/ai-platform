import { Button, FormDialog, FormTextarea } from "@ngriffin_uk/polychat-component-ui";
import { getProjectTaskPath, useProjectTasks } from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export function AskLeadButton({
  workspaceId,
  projectId,
  leadTeammateId,
  label,
  title,
  question,
  placeholder,
  objective,
  brief,
}: {
  workspaceId: string;
  projectId: string;
  leadTeammateId: string | null;
  label: string;
  title: string;
  question: string;
  placeholder: string;
  objective: (request: string) => string;
  brief: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [request, setRequest] = useState("");
  const { create, start } = useProjectTasks(projectId);
  const navigate = useNavigate();

  if (!leadTeammateId) {
    return null;
  }

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        icon={<Sparkles size={14} />}
        onClick={() => setIsOpen(true)}
      >
        {label}
      </Button>
      <FormDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title={title}
        description="The lead picks this up as a task, works it out and asks you only for what needs a decision."
        submitText="Hand it to the lead"
        isLoading={create.isPending || start.isPending}
        submitDisabled={!request.trim()}
        onSubmit={async () => {
          try {
            const { task } = await create.mutateAsync({
              objective: objective(request.trim()),
              description: `${request.trim()}\n\n${brief}`,
              owner: { type: "teammate", id: leadTeammateId },
            });

            await start.mutateAsync(task.id);
            setRequest("");
            setIsOpen(false);
            toast.success("Handed to the lead");
            void navigate(getProjectTaskPath(workspaceId, projectId, task.id));
          } catch (error) {
            toast.error(getErrorMessage(error, "The lead could not take this on"));
          }
        }}
      >
        <FormTextarea
          label={question}
          rows={3}
          value={request}
          placeholder={placeholder}
          onChange={(event) => setRequest(event.target.value)}
        />
      </FormDialog>
    </>
  );
}
