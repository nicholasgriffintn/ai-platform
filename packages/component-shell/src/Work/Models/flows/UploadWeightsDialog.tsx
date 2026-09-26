import {
  FileDropzone,
  FormDialog,
  FormGrid,
  FormInput,
  FormSection,
  FormSelect,
  FormTextarea,
} from "@ngriffin_uk/polychat-component-ui";
import {
  useModelLibrary,
  useModelPlatformMutations,
  useModelUpload,
} from "@ngriffin_uk/polychat-library-react";
import { formatBytes, getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { useModelsScope } from "../ModelsScope.js";

const PICKLE_PATTERN = /\.(bin|pt|pth|pkl|pickle|ckpt)$/i;

function UploadProgress({
  uploaded,
  total,
  label,
}: {
  uploaded: number;
  total: number;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">
          {formatBytes(uploaded, 1)} of {formatBytes(total, 1)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-active-work transition-[width]"
          style={{ width: `${total === 0 ? 0 : Math.round((uploaded / total) * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function UploadWeightsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspaceId, projectId, open: openObject } = useModelsScope();
  const upload = useModelUpload(workspaceId);
  const mutations = useModelPlatformMutations(workspaceId);
  const bases = useModelLibrary(workspaceId, "model", projectId);
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"model" | "adapter">("model");
  const [baseVersionId, setBaseVersionId] = useState("");
  const [licence, setLicence] = useState("");
  const [provenance, setProvenance] = useState("");
  const [intendedUse, setIntendedUse] = useState("");
  const pickles = files.filter((file) => PICKLE_PATTERN.test(file.name));
  const busy = upload.isUploading || mutations.registerUpload.isPending;
  const complete =
    files.length > 0 &&
    pickles.length === 0 &&
    Boolean(name.trim()) &&
    Boolean(licence.trim()) &&
    Boolean(provenance.trim()) &&
    (kind === "model" || Boolean(baseVersionId));

  const close = (value: boolean) => {
    if (!value && !busy) {
      upload.reset();
      setFiles([]);
    }

    onOpenChange(value);
  };

  const register = (uploadId: string) =>
    runWithToast("Uploaded and queued for review", () =>
      mutations.registerUpload.mutateAsync({
        uploadId,
        projectId: projectId ?? null,
        kind,
        baseVersionId: kind === "adapter" ? baseVersionId || null : null,
        licence,
        provenance,
        intendedUse,
      }),
    );

  const submit = async () => {
    const session = await upload
      .startAsync({
        purpose: kind,
        name,
        sources: files.map((file) => ({ path: file.webkitRelativePath || file.name, file })),
      })
      .catch(() => null);
    const detail = session ? await register(session.id) : undefined;

    if (detail) {
      upload.reset();
      setFiles([]);
      onOpenChange(false);
      openObject("versions", detail.version.id);
    }
  };

  const progress = upload.progress;
  const stage =
    upload.session?.status === "hashing"
      ? "Checking every file"
      : upload.isReady
        ? "Registering"
        : "Uploading";

  return (
    <FormDialog
      open={open}
      onOpenChange={close}
      size="lg"
      title="Upload weights"
      description="Files go to private storage, are hashed, and are published to your Hugging Face account when one is connected. Pickle formats are refused because loading them can run code."
      onSubmit={submit}
      submitText="Upload and register"
      isLoading={busy || mutations.registerUpload.isPending}
      submitDisabled={!complete}
    >
      <div className="space-y-5">
        <FormSection title="Files">
          <FormGrid>
            <FormInput
              label="Name"
              placeholder="support-7b"
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
            <FormSelect
              label="What is it"
              value={kind}
              disabled={busy}
              onValueChange={setKind}
              options={[
                { value: "model", label: "A full model" },
                { value: "adapter", label: "A LoRA or other adapter" },
              ]}
            />
          </FormGrid>
          <FileDropzone
            multiple
            hint="Safetensors, GGUF or ONNX weights, plus config and tokenizer files"
            files={files}
            disabled={busy}
            onFilesChange={setFiles}
            fileNote={(file) =>
              PICKLE_PATTERN.test(file.name)
                ? "Pickle format. Convert it to safetensors first."
                : null
            }
          />
          {progress && busy && (
            <UploadProgress
              uploaded={progress.uploadedBytes}
              total={progress.totalBytes}
              label={stage}
            />
          )}
          {upload.error && (
            <p className="text-sm text-failure">{getErrorMessage(upload.error, "Upload failed")}</p>
          )}
          {upload.session?.status === "failed" && (
            <p className="text-sm text-failure">{upload.session.failureReason}</p>
          )}
        </FormSection>

        <FormSection
          title="Provenance"
          description="Recorded as evidence and checked by policy before anyone can use the weights."
        >
          {kind === "adapter" && (
            <FormSelect
              label="Adapter for"
              value={baseVersionId}
              disabled={busy}
              onValueChange={setBaseVersionId}
              placeholder="Choose the base model"
              options={(bases.data ?? []).map((entry) => ({
                value: entry.version.id,
                label: entry.asset.displayName,
              }))}
            />
          )}
          <FormGrid>
            <FormInput
              label="Licence"
              placeholder="apache-2.0"
              value={licence}
              disabled={busy}
              onChange={(event) => setLicence(event.target.value)}
            />
            <FormInput
              label="Intended use (optional)"
              placeholder="Internal support assistant"
              value={intendedUse}
              disabled={busy}
              onChange={(event) => setIntendedUse(event.target.value)}
            />
          </FormGrid>
          <FormTextarea
            label="Where it came from"
            placeholder="Who trained it, from which base and on what data."
            value={provenance}
            disabled={busy}
            onChange={(event) => setProvenance(event.target.value)}
          />
        </FormSection>
      </div>
    </FormDialog>
  );
}
