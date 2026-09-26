import {
  FormDialog,
  FormInput,
  FormSection,
  FormSelect,
  Switch,
} from "@ngriffin_uk/polychat-component-ui";
import { useModelPlatformMutations, useModelRoutes } from "@ngriffin_uk/polychat-library-react";
import type { AliasGate } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { useModelsScope } from "../ModelsScope.js";
import { AliasGateFields } from "./AliasGateFields.js";

export function CreateAliasDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspaceId, projectId, open: openObject } = useModelsScope();
  const mutations = useModelPlatformMutations(workspaceId);
  const routes = useModelRoutes(workspaceId, projectId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [routeId, setRouteId] = useState("none");
  const [gate, setGate] = useState<AliasGate | null>(null);
  const [requiresApproval, setRequiresApproval] = useState(false);

  const submit = async () => {
    const alias = await runWithToast("Alias created", () =>
      mutations.createAlias.mutateAsync({
        projectId: projectId ?? null,
        name,
        description: description || undefined,
        routeId: routeId === "none" ? null : routeId,
        gate,
        requiresApproval,
      }),
    );

    if (alias) {
      onOpenChange(false);
      openObject("aliases", alias.id);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New alias"
      description="A stable name chat, teammates and apps call. Promotions and rollbacks move the alias, never the client."
      onSubmit={submit}
      submitText="Create alias"
      isLoading={mutations.createAlias.isPending}
      submitDisabled={!/^[a-z0-9][a-z0-9-]{1,47}$/.test(name)}
    >
      <div className="space-y-5">
        <FormSection title="Alias">
          <FormInput
            label="Name"
            description="Lowercase letters, digits and dashes. People pick it by this name in chat."
            placeholder="support"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <FormInput
            label="Description (optional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <FormSelect
            label="Serves"
            value={routeId}
            onValueChange={setRouteId}
            options={[
              { value: "none", label: "Nothing yet" },
              ...(routes.data ?? [])
                .filter((route) => route.status === "active")
                .map((route) => ({
                  value: route.id,
                  label: `${route.displayName} · ${route.provider}`,
                })),
            ]}
          />
        </FormSection>
        <FormSection
          title="Promotion safety"
          description="Checked every time a new route is promoted behind this alias."
        >
          <AliasGateFields gate={gate} onChange={setGate} />
          <Switch
            label="Require an approver"
            description="Promotions wait for someone with approval rights."
            checked={requiresApproval}
            onChange={(event) => setRequiresApproval(event.target.checked)}
          />
        </FormSection>
      </div>
    </FormDialog>
  );
}
