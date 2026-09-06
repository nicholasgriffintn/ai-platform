import {
  CatalogueCard,
  CatalogueSection,
  CatalogueSkeletonGrid,
  getIcon,
} from "@ngriffin_uk/polychat-component-capabilities";
import { ProviderGlyph } from "@ngriffin_uk/polychat-component-models";
import { Badge, Button, ButtonLink, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  listTeammateRolesByCategory,
  TEAMMATE_PERMISSIONS_SENTENCE,
  type ModelToolDefinition,
  type ProjectExperienceDefinition,
  type RecipeCatalogueSummary,
  type TeammateRole,
  type Tool,
} from "@ngriffin_uk/polychat-schemas";
import { Bot, Sparkles, Terminal, Workflow, Wrench } from "lucide-react";

import { useAuthStatus } from "~/hooks/useAuth";
import { usePublicCapabilityCatalogue } from "~/hooks/useCapabilityCatalog";
import { buildComposerPrefillHref } from "~/lib/composer-prefill";
import { getPlacePaths } from "~/lib/navigation/places";
import { useUIStore } from "~/state/stores/uiStore";

const CATALOGUE_SECTIONS = [
  { id: "apps", label: "Apps" },
  { id: "teammates", label: "Teammates" },
  { id: "automations", label: "Automations" },
  { id: "model-tools", label: "Model tools" },
  { id: "tools", label: "Function tools" },
  { id: "yours", label: "Curated by you" },
] as const;

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

function AppList({ apps }: { apps: ProjectExperienceDefinition[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {apps.map((app) => (
        <CatalogueCard
          key={app.id}
          icon={getIcon(app.icon, app.theme, "h-5 w-5")}
          title={app.name}
          description={`${app.when} It works from ${app.uses.toLowerCase()} and leaves behind ${app.produces.toLowerCase()}`}
          badges={
            <>
              {app.category ? <Badge variant="outline">{app.category}</Badge> : null}
              {app.scope === "personal" ? (
                <Badge variant="outline" title={app.scopeReason ?? undefined}>
                  Personal only
                </Badge>
              ) : null}
            </>
          }
          footer={<TryLink prompt={`${app.when} Use ${app.name}.`} label={`Open ${app.name}`} />}
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
            <TryLink
              prompt={`Hire a ${role.title.toLowerCase()} and get started.`}
              label={`Hire a ${role.title.toLowerCase()}`}
            />
          }
        />
      ))}
    </ul>
  );
}

function AutomationList({ recipes }: { recipes: RecipeCatalogueSummary[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((recipe) => (
        <CatalogueCard
          key={recipe.id}
          icon={<Workflow size={20} strokeWidth={1.5} />}
          title={recipe.title}
          description={recipe.summary}
          badges={
            <>
              <Badge variant="outline">{recipe.category}</Badge>
              <Badge variant={recipe.kind === "automate" ? "info" : "secondary"}>
                {recipe.kind === "automate" ? "Automates" : "Integrates"}
              </Badge>
              {recipe.featured && <Badge variant="success">Featured</Badge>}
            </>
          }
          footer={
            recipe.integrations.length > 0 ? (
              <ul aria-label="Connected services" className="flex flex-wrap gap-1.5 pt-1">
                {recipe.integrations.map((integration) => (
                  <li
                    key={integration.id}
                    className="bg-surface-elevated text-muted-foreground flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]"
                  >
                    <ProviderGlyph name={integration.providerId} size={12} />
                    {integration.name}
                  </li>
                ))}
              </ul>
            ) : undefined
          }
        />
      ))}
    </ul>
  );
}

function ModelToolList({ modelTools }: { modelTools: ModelToolDefinition[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {modelTools.map((tool) => (
        <CatalogueCard
          key={tool.id}
          icon={<Terminal size={20} strokeWidth={1.5} />}
          title={tool.label}
          description={tool.description}
          badges={
            <>
              <Badge variant="outline">{tool.category}</Badge>
              {tool.requiresConfiguration && <Badge variant="warning">Needs setup</Badge>}
            </>
          }
          footer={<p className="text-muted-foreground font-mono text-[11px]">{tool.command}</p>}
        />
      ))}
    </ul>
  );
}

function ToolList({ tools }: { tools: Tool[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <CatalogueCard
          key={tool.id}
          icon={<Wrench size={20} strokeWidth={1.5} />}
          title={tool.name}
          description={tool.description}
          badges={
            <>
              <Badge variant="outline">{tool.category}</Badge>
              {tool.type === "premium" && <Badge variant="info">Pro</Badge>}
              {tool.type === "byok" && <Badge variant="success">Your keys</Badge>}
            </>
          }
        />
      ))}
    </ul>
  );
}

function CuratedByYou() {
  const { isAuthenticated } = useAuthStatus();
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);
  const items = [
    {
      icon: <Bot size={20} strokeWidth={1.5} />,
      title: "Teammates",
      body: "Give a teammate a name, a brief and the tools it may use, then hand it work in Chat or in a project. Teammates live in your account or a workspace, never in a shared list.",
    },
    {
      icon: <Sparkles size={20} strokeWidth={1.5} />,
      title: "Skills",
      body: "A skill is a reusable instruction set a teammate follows on demand. Write your own, keep them personal, or share them into a project.",
    },
    {
      icon: <Workflow size={20} strokeWidth={1.5} />,
      title: "Installed automations",
      body: "Every automation above is a template. Installing one connects your services, sets its schedule or trigger, and puts it under your governance.",
    },
  ];

  return (
    <div className="space-y-5">
      <ul className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <li
            key={item.title}
            className="bg-surface border-border flex flex-col gap-3 rounded-xl border p-4"
          >
            <span className="bg-selection text-active-work flex h-10 w-10 items-center justify-center rounded-lg">
              {item.icon}
            </span>
            <span className="text-foreground text-sm font-medium">{item.title}</span>
            <p className="text-muted-foreground text-xs leading-relaxed">{item.body}</p>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        {isAuthenticated ? (
          <ButtonLink href={getPlacePaths("chat").teammates}>Open your teammates</ButtonLink>
        ) : (
          <Button type="button" variant="primary" onClick={() => setShowLoginModal(true)}>
            Sign in to start curating
          </Button>
        )}
        <ButtonLink variant="outline" href="/discover">
          Back to the tour
        </ButtonLink>
      </div>
    </div>
  );
}

export function PublicAppsCatalogue() {
  const { data, isLoading, error } = usePublicCapabilityCatalogue();
  const apps = data?.experiences ?? [];
  const modelTools = data?.modelTools ?? [];
  const tools = data?.tools ?? [];
  const recipes = data?.recipes ?? [];
  const roleGroups = listTeammateRolesByCategory();
  const roleCount = roleGroups.reduce((total, group) => total + group.roles.length, 0);
  const lede = data
    ? `${apps.length} apps, ${roleCount} teammate roles, ${modelTools.length + tools.length} tools and ${recipes.length} automation templates come with every account.`
    : "Apps, teammate roles, tools and automation templates come with every account.";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-14 px-4 pb-16 sm:px-6">
      <header className="space-y-4 pt-2">
        <p className="polychat-eyebrow">The catalogue</p>
        <h1 className="font-display text-foreground text-4xl font-medium tracking-tight text-balance md:text-5xl">
          Everything you can ask for on your first day
        </h1>
        <p className="text-muted-foreground max-w-prose text-lg leading-relaxed">{lede}</p>
        <p className="text-muted-foreground max-w-prose leading-relaxed">
          Every app and teammate below opens a conversation with the ask already typed, so you can
          see what happens before you decide anything. {TEAMMATE_PERMISSIONS_SENTENCE}
        </p>
        <nav aria-label="Catalogue sections" className="flex flex-wrap gap-2">
          {CATALOGUE_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="bg-surface border-border text-foreground hover:border-border-strong rounded-full border px-3 py-1 text-xs font-medium no-underline transition-colors"
            >
              {section.label}
            </a>
          ))}
        </nav>
      </header>

      {error ? (
        <EmptyState
          title="The catalogue is out of reach"
          message="The catalogue could not be loaded. Try again in a moment."
          className="min-h-[200px]"
        />
      ) : (
        <>
          <CatalogueSection
            id="apps"
            headingId="catalogue-apps-title"
            eyebrow="Built in"
            title="Apps"
            lede="Longer jobs with their own surface. Each says when to reach for it, what it works from and what it leaves behind."
          >
            {isLoading ? <CatalogueSkeletonGrid count={6} /> : <AppList apps={apps} />}
          </CatalogueSection>

          <CatalogueSection
            id="teammates"
            headingId="catalogue-teammates-title"
            eyebrow="Built in"
            title="Teammates"
            lede="Hire one by name, or describe the job and let Polychat write the brief."
          >
            <div className="space-y-8">
              {roleGroups.map((group) => (
                <div key={group.category} className="space-y-3">
                  <h3 className="text-foreground text-sm font-medium">{group.category}</h3>
                  <RoleList roles={group.roles} />
                </div>
              ))}
            </div>
          </CatalogueSection>

          <CatalogueSection
            id="automations"
            headingId="catalogue-automations-title"
            eyebrow="Templates"
            title="Automations"
            lede="Standing work that runs on a schedule or when something happens. Install one and it becomes yours to configure."
          >
            {isLoading ? <CatalogueSkeletonGrid count={6} /> : <AutomationList recipes={recipes} />}
          </CatalogueSection>

          <CatalogueSection
            id="model-tools"
            headingId="catalogue-model-tools-title"
            eyebrow="Built in"
            title="Model tools"
            lede="Tools a model can call mid-reply, invoked with a slash command or picked up automatically when the task calls for them."
          >
            {isLoading ? (
              <CatalogueSkeletonGrid count={6} />
            ) : (
              <ModelToolList modelTools={modelTools} />
            )}
          </CatalogueSection>

          <CatalogueSection
            id="tools"
            headingId="catalogue-tools-title"
            eyebrow="Built in"
            title="Function tools"
            lede="Everything a teammate can do beyond talking. Some need a Pro plan, some run on your own provider keys, and the rest come with every account."
          >
            {isLoading ? <CatalogueSkeletonGrid count={9} /> : <ToolList tools={tools} />}
          </CatalogueSection>

          <CatalogueSection
            id="yours"
            headingId="catalogue-yours-title"
            eyebrow="Curated by you"
            title="Teammates, skills and installed automations are yours"
            lede="The catalogue ends where your account begins. Nothing here is shared across people; each person or workspace builds its own set."
          >
            <CuratedByYou />
          </CatalogueSection>
        </>
      )}
    </div>
  );
}
