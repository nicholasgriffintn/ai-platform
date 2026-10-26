import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormInput,
  FormTextarea,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import { type FormEvent, useRef, useState } from "react";

export interface CreateWorkspaceInput {
  name: string;
  mission: string;
  sources: string[];
  monthlyCredits: number | null;
}

export interface CreateWorkspaceDialogProps {
  open: boolean;
  isSubmitting?: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateWorkspaceInput) => Promise<void>;
}

const SOURCE_PATTERN = /^https?:\/\/\S+$/u;

export function CreateWorkspaceDialog({
  open,
  isSubmitting = false,
  errorMessage,
  onOpenChange,
  onSubmit,
}: CreateWorkspaceDialogProps) {
  const [name, setName] = useState("");
  const [mission, setMission] = useState("");
  const [sources, setSources] = useState("");
  const [budget, setBudget] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const sourceList = sources
    .split(/\s+/u)
    .map((value) => value.trim())
    .filter(Boolean);
  const invalidSource = sourceList.find((value) => !SOURCE_PATTERN.test(value));
  const credits = Number(budget);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({
      name: name.trim(),
      mission: mission.trim(),
      sources: sourceList.slice(0, 10),
      monthlyCredits: budget && credits > 0 ? credits : null,
    });
    setName("");
    setMission("");
    setSources("");
    setBudget("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          nameRef.current?.focus();
        }}
      >
        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="space-y-5"
        >
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>
              A lead teammate reads what you give it and proposes projects, a team, budgets and
              first tasks. Nothing starts until you approve its plan.
            </DialogDescription>
          </DialogHeader>
          <FormInput
            ref={nameRef}
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={80}
            required
          />
          <FormTextarea
            label="What does it do?"
            value={mission}
            onChange={(event) => setMission(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="We help small UK retailers get paid on time, without chasing."
            required
          />
          <FormTextarea
            label="What can the lead read?"
            description="Links to your website, docs or repository, one per line. It reads only these before you approve."
            value={sources}
            onChange={(event) => setSources(event.target.value)}
            rows={2}
            placeholder="https://"
          />
          <FormInput
            label="Monthly budget in credits"
            description="Shared by the whole team. Leave empty for no cap."
            inputMode="decimal"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
          />
          {invalidSource ? (
            <p role="alert" className="text-sm text-failure">
              {invalidSource} is not a link. Use full addresses starting with https://
            </p>
          ) : null}
          {errorMessage && (
            <p role="alert" className="text-sm text-failure">
              {errorMessage}
            </p>
          )}
          <DialogFooter>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={name.trim().length < 2 || !mission.trim() || Boolean(invalidSource)}
            >
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
  const nameRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({ name, description, instructions });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          nameRef.current?.focus();
        }}
      >
        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="space-y-5"
        >
          <DialogHeader>
            <DialogTitle>Create a project</DialogTitle>
            <DialogDescription>
              Projects contain their own conversations, instructions, and capabilities.
            </DialogDescription>
          </DialogHeader>
          <FormInput
            ref={nameRef}
            label="Project name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={100}
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
            <Textarea
              id="project-instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              maxLength={8000}
              rows={5}
              className="bg-surface-elevated py-2"
              placeholder="Add context, terminology, constraints, or working preferences."
            />
          </div>
          {errorMessage && (
            <p role="alert" className="text-sm text-failure">
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
