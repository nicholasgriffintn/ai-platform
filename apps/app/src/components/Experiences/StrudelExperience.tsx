import {
  StrudelPatternForm,
  StrudelPatternGrid,
  StrudelPlayer,
} from "@ngriffin_uk/polychat-component-experiences/music";
import {
  ButtonLink,
  CardGridLoadingSkeleton,
  EmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import { parseCommaSeparatedTags } from "@ngriffin_uk/polychat-utility-core";
import { Music2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { StrudelCreateStudio } from "~/components/Apps/Strudel/StrudelCreateStudio";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import {
  useDeleteStrudelPattern,
  useGenerateStrudelPattern,
  useSaveStrudelPattern,
  useStrudelPattern,
  useStrudelPatterns,
  useUpdateStrudelPattern,
} from "~/hooks/useStrudel";
import { isAuthenticationError } from "~/lib/errors";
import { useUIStore } from "~/state/stores/uiStore";

const STARTER_PATTERN = 's("bd sd, hh*8").bank("RolandTR909").gain(0.8)';

export function StrudelExperience({ basePath, projectId, subpath }: ExperienceProps) {
  const segments = subpath.split("/").filter(Boolean);
  const patternId = segments[0] && segments[0] !== "new" ? segments[0] : undefined;
  const isNew = segments[0] === "new";
  const {
    data: patterns,
    isLoading,
    error,
  } = useStrudelPatterns(projectId, {
    enabled: !isNew && !patternId,
  });

  if (isNew) {
    return <StrudelCreateStudio basePath={basePath} projectId={projectId} />;
  }

  if (patternId) {
    return <PatternEditor basePath={basePath} patternId={patternId} projectId={projectId} />;
  }

  if (isLoading) {
    return <CardGridLoadingSkeleton count={4} label="Loading music patterns" />;
  }

  if (isAuthenticationError(error)) {
    return (
      <SignInEmptyState
        title="Sign in to view patterns"
        message="Patterns are kept against your account."
      />
    );
  }

  if (error) {
    return <EmptyState title="Patterns unavailable" message={error.message} />;
  }

  if (!patterns?.length) {
    return (
      <EmptyState
        icon={<Music2 size={24} className="text-muted-foreground" />}
        title="No patterns yet"
        message="Write or generate a live-coded music pattern."
        action={
          <ButtonLink variant="primary" icon={<Plus size={16} />} href={`${basePath}/new`}>
            New pattern
          </ButtonLink>
        }
      />
    );
  }

  return (
    <StrudelPatternGrid
      patterns={patterns.map((pattern) => ({
        id: pattern.id,
        name: pattern.name,
        description: pattern.description,
        code: pattern.code,
        tags: pattern.tags,
        updatedAt: pattern.updatedAt,
        href: `${basePath}/${pattern.id}`,
      }))}
      newPatternHref={`${basePath}/new`}
    />
  );
}

function PatternEditor({
  basePath,
  patternId,
  projectId,
}: {
  basePath: string;
  patternId?: string;
  projectId?: string;
}) {
  const navigate = useNavigate();
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);
  const { data: pattern, isLoading, error } = useStrudelPattern(patternId, projectId);
  const save = useSaveStrudelPattern(projectId);
  const update = useUpdateStrudelPattern(patternId, projectId);
  const remove = useDeleteStrudelPattern(projectId);
  const generate = useGenerateStrudelPattern(projectId);
  const [name, setName] = useState("Untitled pattern");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [prompt, setPrompt] = useState("");
  const [code, setCode] = useState(STARTER_PATTERN);
  const tags = useMemo(() => parseCommaSeparatedTags(tagsInput), [tagsInput]);

  useEffect(() => {
    if (!pattern) {
      return;
    }

    setName(pattern.name);
    setDescription(pattern.description ?? "");
    setTagsInput((pattern.tags ?? []).join(", "));
    setCode(pattern.code);
  }, [pattern]);

  if (patternId && isLoading) {
    return <CardGridLoadingSkeleton count={1} label="Loading music pattern" />;
  }

  if (patternId && isAuthenticationError(error)) {
    return (
      <SignInEmptyState
        title="Sign in to view this pattern"
        message="Sign in to open this pattern."
      />
    );
  }

  if (patternId && (error || !pattern)) {
    return (
      <EmptyState title="Pattern unavailable" message={error?.message ?? "Pattern not found"} />
    );
  }

  const mutationError = save.error ?? update.error ?? remove.error ?? generate.error;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
      <StrudelPlayer code={code} onChange={setCode} />
      <StrudelPatternForm
        name={name}
        onNameChange={setName}
        tagsInput={tagsInput}
        onTagsInputChange={setTagsInput}
        tags={tags}
        description={description}
        onDescriptionChange={setDescription}
        prompt={prompt}
        onPromptChange={setPrompt}
        isGenerating={generate.isPending}
        onGenerate={async () => {
          const result = await generate.mutateAsync({ prompt: prompt.trim() });

          setCode(result.code);
        }}
        canSave={!!name.trim() && !!code.trim()}
        isSaving={save.isPending || update.isPending}
        onSave={async () => {
          if (patternId) {
            await update.mutateAsync({
              name: name.trim(),
              description: description.trim() || undefined,
              code,
              tags,
            });
          } else {
            const created = await save.mutateAsync({
              name: name.trim(),
              description: description.trim() || undefined,
              code,
              tags,
            });

            void navigate(`${basePath}/${created.id}`, { replace: true });
          }
        }}
        canDelete={!!patternId}
        isDeleting={remove.isPending}
        onDelete={async () => {
          if (!patternId) {
            return;
          }

          await remove.mutateAsync(patternId);
          void navigate(basePath);
        }}
        requiresSignIn={isAuthenticationError(mutationError)}
        onSignIn={() => setShowLoginModal(true)}
        errorMessage={mutationError?.message}
      />
    </div>
  );
}

interface ExperienceProps {
  basePath: string;
  projectId?: string;
  subpath: string;
}
