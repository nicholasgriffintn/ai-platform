import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormInput,
} from "@ngriffin_uk/polychat-component-ui";
import { type FormEvent, useState } from "react";

export interface CreateWorkspaceInput {
  name: string;
  description: string;
}

export interface CreateWorkspaceDialogProps {
  open: boolean;
  isSubmitting?: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateWorkspaceInput) => Promise<void>;
}

export function CreateWorkspaceDialog({
  open,
  isSubmitting = false,
  errorMessage,
  onOpenChange,
  onSubmit,
}: CreateWorkspaceDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({ name, description });
    setName("");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Create a workspace</DialogTitle>
            <DialogDescription>Workspaces contain projects, members, and access.</DialogDescription>
          </DialogHeader>
          <FormInput
            label="Workspace name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={80}
            autoFocus
            required
          />
          <FormInput
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
            placeholder="Describe this workspace"
          />
          {errorMessage && (
            <p role="alert" className="text-sm text-red-700">
              {errorMessage}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" isLoading={isSubmitting}>
              Create workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface CreateProjectInput {
  name: string;
  description: string;
  instructions: string;
}

export interface CreateProjectDialogProps {
  open: boolean;
  isSubmitting?: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateProjectInput) => Promise<void>;
}

export function CreateProjectDialog({
  open,
  isSubmitting = false,
  errorMessage,
  onOpenChange,
  onSubmit,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({ name, description, instructions });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Create a project</DialogTitle>
            <DialogDescription>
              Projects contain their own conversations, instructions, and capabilities.
            </DialogDescription>
          </DialogHeader>
          <FormInput
            label="Project name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={100}
            autoFocus
            required
          />
          <FormInput
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={1000}
            placeholder="Describe this project"
          />
          <div className="space-y-1">
            <label htmlFor="project-instructions" className="text-sm font-medium">
              Project instructions
            </label>
            <textarea
              id="project-instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              maxLength={8000}
              rows={5}
              className="w-full rounded-md border border-zinc-200 bg-off-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Add context, terminology, constraints, or working preferences."
            />
          </div>
          {errorMessage && (
            <p role="alert" className="text-sm text-red-700">
              {errorMessage}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" isLoading={isSubmitting}>
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
