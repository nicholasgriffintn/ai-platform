import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormInput,
  FormSelect,
  FormTextarea,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import { resolveHttpUrl } from "@ngriffin_uk/polychat-utility-core";
import { type FormEvent, useRef, useState } from "react";

export interface CreateWorkspaceInput {
  name: string;
  mission: string;
  sources: string[];
  monthlyCredits: number | null;
  templateId: string | null;
}

export interface CreateWorkspaceDialogProps {
  open: boolean;
  teamTemplates?: readonly { id: string; name: string }[];
  isSubmitting?: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateWorkspaceInput) => Promise<void>;
}

export function CreateWorkspaceDialog({
  open,
  teamTemplates = [],
  isSubmitting = false,
  errorMessage,
  onOpenChange,
  onSubmit,
}: CreateWorkspaceDialogProps) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [mission, setMission] = useState("");
  const [sources, setSources] = useState("");
  const [budget, setBudget] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const sourceList = sources
    .split(/\s+/u)
    .map((value) => value.trim())
    .filter(Boolean);
  const invalidSource = sourceList.find((value) => !resolveHttpUrl(value));
  const credits = Number(budget);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit({
      name: name.trim(),
      mission: mission.trim(),
      sources: sourceList.slice(0, 10),
      monthlyCredits: budget && credits > 0 ? credits : null,
      templateId: templateId || null,
    });
    setName("");
    setMission("");
    setSources("");
    setBudget("");
    setTemplateId("");
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
          {teamTemplates.length ? (
            <FormSelect
              label="Start from"
              description="A team template gives the lead a first plan to check, instead of a blank page."
              value={templateId}
              onValueChange={setTemplateId}
              options={[
                { value: "", label: "A blank plan" },
                ...teamTemplates.map((template) => ({ value: template.id, label: template.name })),
              ]}
            />
          ) : null}
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

export type ProjectStart =
  | { kind: "blank" }
  | { kind: "starter"; slug: string }
  | { kind: "template"; id: string };

export interface CreateProjectDialogProps {
  open: boolean;
  starters?: readonly { slug: string; name: string; teammates: readonly { name: string }[] }[];
  templates?: readonly { id: string; name: string }[];
  isSubmitting?: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateProjectInput) => Promise<void>;
  onStartFrom?: (start: Exclude<ProjectStart, { kind: "blank" }>) => Promise<void>;
  onDeleteTemplate?: (templateId: string) => void;
}

function encodeProjectStart(start: ProjectStart): string {
  return start.kind === "blank"
    ? "blank"
    : start.kind === "starter"
      ? `starter:${start.slug}`
      : `template:${start.id}`;
}

function decodeProjectStart(value: string): ProjectStart {
  const [kind, id] = value.split(":", 2);

  if (kind === "starter" && id) {
    return { kind: "starter", slug: id };
  }

  return kind === "template" && id ? { kind: "template", id } : { kind: "blank" };
}

export function CreateProjectDialog({
  open,
  starters = [],
  templates = [],
  isSubmitting = false,
  errorMessage,
  onOpenChange,
  onSubmit,
  onStartFrom,
  onDeleteTemplate,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [start, setStart] = useState<ProjectStart>({ kind: "blank" });
  const nameRef = useRef<HTMLInputElement>(null);
  const canStartFrom = Boolean(onStartFrom) && starters.length + templates.length > 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (start.kind === "blank") {
      await onSubmit({ name, description, instructions });
    } else {
      await onStartFrom?.(start);
    }
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
          {canStartFrom ? (
            <div className="space-y-1.5">
              <FormSelect
                label="Start from"
                value={encodeProjectStart(start)}
                options={[
                  { value: "blank", label: "A blank project" },
                  ...starters.map((starter) => ({
                    value: encodeProjectStart({ kind: "starter", slug: starter.slug }),
                    label: `${starter.name} · hires ${starter.teammates.map((teammate) => teammate.name).join(", ")}`,
                  })),
                  ...templates.map((template) => ({
                    value: encodeProjectStart({ kind: "template", id: template.id }),
                    label: `${template.name} · your template`,
                  })),
                ]}
                onValueChange={(value) => setStart(decodeProjectStart(value))}
              />
              {start.kind === "template" && onDeleteTemplate ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline hover:text-failure"
                  onClick={() => {
                    onDeleteTemplate(start.id);
                    setStart({ kind: "blank" });
                  }}
                >
                  Delete this template
                </button>
              ) : null}
            </div>
          ) : null}
          {start.kind === "blank" ? (
            <>
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
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {start.kind === "starter"
                ? "The project arrives with its teammates already hired and briefed."
                : "The project is created with the template's brief, flow and capabilities."}
            </p>
          )}
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
