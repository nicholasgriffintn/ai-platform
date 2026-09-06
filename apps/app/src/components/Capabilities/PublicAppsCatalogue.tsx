import {
  CatalogueCard,
  CatalogueSection,
  CatalogueSkeletonGrid,
  getIcon,
} from "@ngriffin_uk/polychat-component-capabilities";
import { Badge, ButtonLink, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  listTeammateRolesByCategory,
  TEAMMATE_PERMISSIONS_SENTENCE,
  type ProjectExperienceDefinition,
  type TeammateRole,
} from "@ngriffin_uk/polychat-schemas";
import { Bot } from "lucide-react";

import { usePublicCapabilityCatalogue } from "~/hooks/useCapabilityCatalog";
import { buildComposerPrefillHref } from "~/lib/composer-prefill";

function appPrompt(experience: ProjectExperienceDefinition): string {
  return `${experience.when} Use ${experience.name}.`;
}

function rolePrompt(role: TeammateRole): string {
  return `Hire a ${role.title.toLowerCase()} and get started.`;
}

function TryLink({ prompt, label }: { prompt: string; label: string }) {
  return (
    <ButtonLink
      href={buildComposerPrefillHref(prompt)}
      variant="outline"
      size="xs"
      className="mt-2"
    >
      {label}
    </ButtonLink>
  );
}

function AppList({ experiences }: { experiences: ProjectExperienceDefinition[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {experiences.map((experience) => (
        <CatalogueCard
          key={experience.id}
          icon={getIcon(experience.icon, experience.theme, "h-5 w-5")}
          title={experience.name}
          description={`${experience.when} It works from ${experience.uses.toLowerCase()} and leaves behind ${experience.produces.toLowerCase()}`}
          badges={
            <>
              {experience.category ? <Badge variant="outline">{experience.category}</Badge> : null}
              {experience.scope === "personal" ? (
                <Badge variant="outline" title={experience.scopeReason ?? undefined}>
                  Personal only
                </Badge>
              ) : null}
            </>
          }
          footer={<TryLink prompt={appPrompt(experience)} label={`Open ${experience.name}`} />}
        />
      ))}
    </ul>
  );
}

function RoleList({ roles }: { roles: TeammateRole[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {roles.map((role) => (
        <CatalogueCard
          key={role.slug}
          icon={<Bot size={20} strokeWidth={1.5} />}
          title={role.title}
          description={role.summary}
          badges={
            <>
              <Badge variant="outline">{role.category}</Badge>
              {role.kind === "bot" ? <Badge variant="outline">Bot</Badge> : null}
            </>
          }
          footer={
            <TryLink prompt={rolePrompt(role)} label={`Hire a ${role.title.toLowerCase()}`} />
          }
        />
      ))}
    </ul>
  );
}

export function PublicAppsCatalogue() {
  const { data, error, isLoading } = usePublicCapabilityCatalogue();
  const experiences = data?.experiences ?? [];
  const roleGroups = listTeammateRolesByCategory();

  return (
    <div className="space-y-14">
      <div className="space-y-3">
        <p className="polychat-eyebrow">Apps and teammates</p>
        <h1 className="font-display text-foreground text-4xl font-medium tracking-tight text-balance">
          Everything you can ask for on your first day
        </h1>
        <p className="text-muted-foreground max-w-prose leading-relaxed">
          Apps are the longer jobs that need their own surface. Teammates are the people you hire to
          do them. Every card here opens a conversation with the ask already typed, so you can see
          what happens before you decide anything. {TEAMMATE_PERMISSIONS_SENTENCE}
        </p>
      </div>

      {error ? (
        <EmptyState
          title="Catalogue unavailable"
          message={error.message}
          className="min-h-[200px]"
        />
      ) : (
        <>
          <CatalogueSection
            id="apps"
            headingId="apps-catalogue-apps-title"
            eyebrow="Built in"
            title="Apps"
            lede="Each one says when to reach for it, what it works from and what it leaves behind."
          >
            {isLoading ? (
              <CatalogueSkeletonGrid count={6} />
            ) : (
              <AppList experiences={experiences} />
            )}
          </CatalogueSection>

          {roleGroups.map((group) => (
            <CatalogueSection
              key={group.category}
              id={`teammates-${group.category.toLowerCase()}`}
              headingId={`apps-catalogue-teammates-${group.category.toLowerCase()}-title`}
              eyebrow="Teammates"
              title={group.category}
              lede="Hire one by name, or describe the job and let Polychat write the brief."
            >
              <RoleList roles={group.roles} />
            </CatalogueSection>
          ))}
        </>
      )}
    </div>
  );
}
