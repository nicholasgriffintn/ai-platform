import {
  FormDialog,
  FormGrid,
  FormInput,
  FormSection,
  FormSelect,
  FormTextarea,
} from "@ngriffin_uk/polychat-component-ui";
import { useModelLibrary, useModelPlatformMutations } from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { useModelsScope } from "../ModelsScope.js";

export function BucketImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspaceId, projectId, open: openObject } = useModelsScope();
  const mutations = useModelPlatformMutations(workspaceId);
  const bases = useModelLibrary(workspaceId, "model", projectId);
  const [uri, setUri] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"model" | "adapter">("model");
  const [baseVersionId, setBaseVersionId] = useState("");
  const [licence, setLicence] = useState("");
  const [provenance, setProvenance] = useState("");

  const submit = async () => {
    const detail = await runWithToast("Registered from the bucket", () =>
      mutations.importBucket.mutateAsync({
        provider: "aws",
        uri: uri.endsWith("/") ? uri : `${uri}/`,
        name,
        kind,
        baseVersionId: kind === "adapter" ? baseVersionId || null : null,
        licence,
        provenance,
      }),
    );

    if (detail) {
      onOpenChange(false);
      openObject("versions", detail.version.id);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Register weights from a bucket"
      description="Point at an S3 prefix in your connected AWS account. We list and hash the files there; nothing is copied."
      onSubmit={submit}
      submitText="Register"
      isLoading={mutations.importBucket.isPending}
      submitDisabled={
        !uri.startsWith("s3://") ||
        !name.trim() ||
        !licence.trim() ||
        !provenance.trim() ||
        (kind === "adapter" && !baseVersionId)
      }
    >
      <div className="space-y-5">
        <FormSection title="Location">
          <FormInput
            label="S3 prefix"
            placeholder="s3://my-bucket/models/support-7b/"
            description="The folder holding the weights, config and tokenizer files."
            value={uri}
            onChange={(event) => setUri(event.target.value)}
          />
          <FormGrid>
            <FormInput
              label="Name"
              placeholder="support-7b"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <FormSelect
              label="What is it"
              value={kind}
              onValueChange={setKind}
              options={[
                { value: "model", label: "A full model" },
                { value: "adapter", label: "A LoRA or other adapter" },
              ]}
            />
          </FormGrid>
          {kind === "adapter" && (
            <FormSelect
              label="Adapter for"
              value={baseVersionId}
              onValueChange={setBaseVersionId}
              placeholder="Choose the base model"
              options={(bases.data ?? []).map((entry) => ({
                value: entry.version.id,
                label: entry.asset.displayName,
              }))}
            />
          )}
        </FormSection>

        <FormSection
          title="Provenance"
          description="Recorded as evidence and checked by policy before anyone can use the weights."
        >
          <FormInput
            label="Licence"
            placeholder="apache-2.0"
            value={licence}
            onChange={(event) => setLicence(event.target.value)}
          />
          <FormTextarea
            label="Where it came from"
            placeholder="Who trained it, from which base and on what data."
            value={provenance}
            onChange={(event) => setProvenance(event.target.value)}
          />
        </FormSection>
      </div>
    </FormDialog>
  );
}
