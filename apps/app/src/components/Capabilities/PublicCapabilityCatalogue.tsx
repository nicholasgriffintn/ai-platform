import { getIcon } from "@ngriffin_uk/polychat-component-capabilities";
import { ProviderGlyph } from "@ngriffin_uk/polychat-component-models";
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  Skeleton,
} from "@ngriffin_uk/polychat-component-ui";
import type {
  ModelToolDefinition,
  ProjectExperienceDefinition,
  RecipeCatalogueSummary,
  Tool,
} from "@ngriffin_uk/polychat-schemas";
import { Bot, Sparkles, Terminal, Workflow, Wrench } from "lucide-react";
import type { ReactNode } from "react";

import { useAuthStatus } from "~/hooks/useAuth";
import { usePublicCapabilityCatalogue } from "~/hooks/useCapabilityCatalog";
import { useUIStore } from "~/state/stores/uiStore";

const CATALOGUE_SECTIONS = [
  { id: "experiences", label: "Experiences" },
  { id: "model-tools", label: "Model tools" },
  { id: "tools", label: "Function tools" },
  { id: "recipes", label: "Recipes" },
  { id: "yours", label: "Curated by you" },
] as const;

function CatalogueSection({
  id,
  eyebrow,
  title,
  lede,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  const headingId = `capabilities-${id}-title`;

  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-20 space-y-5">
      <div className="space-y-2">
        <p className="polychat-eyebrow">{eyebrow}</p>
        <h2
          id={headingId}
          className="font-display text-foreground text-3xl font-medium tracking-tight text-balance"
        >
          {title}
        </h2>
        <p className="text-muted-foreground max-w-prose leading-relaxed">{lede}</p>
      </div>
      {children}
    </section>
  );
}

function CatalogueCard({
  icon,
  title,
  description,
  badges,
  footer,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  badges?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <li className="bg-surface border-border flex flex-col gap-3 rounded-xl border p-4 lg:flex-row">
      <span className="bg-surface-elevated text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
        {icon}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-foreground text-sm font-medium">{title}</span>
          {badges}
        </div>
        <p className="text-muted-foreground line-clamp-3 text-xs leading-relaxed">{description}</p>
        {footer}
      </div>
    </li>
  );
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading">
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <Skeleton className="h-24 w-full rounded-xl" />
        </li>
      ))}
    </ul>
  );
}

function ExperienceList({ experiences }: { experiences: ProjectExperienceDefinition[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {experiences.map((experience) => (
        <CatalogueCard
          key={experience.id}
          icon={getIcon(experience.icon, experience.theme, "h-5 w-5")}
          title={experience.name}
          description={experience.description}
          badges={
            experience.category ? <Badge variant="outline">{experience.category}</Badge> : undefined
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
          footer={<p className="font-mono text-[11px] text-muted-foreground">{tool.command}</p>}
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

function RecipeList({ recipes }: { recipes: RecipeCatalogueSummary[] }) {
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

function CuratedByYou() {
  const { isAuthenticated } = useAuthStatus();
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);
  const items = [
    {
      icon: <Bot size={20} strokeWidth={1.5} />,
      title: "Agents",
      body: "Give an agent a name, a brief and the tools it may use, then hand it tasks in Chat or Work. Agents live in your account or a workspace, never in a shared list.",
    },
    {
      icon: <Sparkles size={20} strokeWidth={1.5} />,
      title: "Skills",
      body: "A skill is a reusable instruction set the assistant follows on demand. Write your own, keep them personal, or share them into a project.",
    },
    {
      icon: <Workflow size={20} strokeWidth={1.5} />,
      title: "Installed recipes",
      body: "Every recipe above is a template. Installing one connects your services, sets its schedule or trigger, and puts it under your governance.",
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
          <ButtonLink href="/chat/capabilities">Open your capabilities</ButtonLink>
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

export function PublicCapabilityCatalogue() {
  const { data, isLoading, error } = usePublicCapabilityCatalogue();
  const experiences = data?.experiences ?? [];
  const modelTools = data?.modelTools ?? [];
  const tools = data?.tools ?? [];
  const recipes = data?.recipes ?? [];
  const lede = data
    ? `${experiences.length} experiences, ${modelTools.length + tools.length} tools and ${recipes.length} recipe templates come with every account. Agents, skills and the recipes you install are yours to curate.`
    : "Experiences, tools and recipe templates come with every account. Agents, skills and the recipes you install are yours to curate.";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-14 px-4 pb-16 sm:px-6">
      <header className="space-y-4 pt-2">
        <p className="polychat-eyebrow">The catalogue</p>
        <h1 className="font-display text-foreground text-4xl font-medium tracking-tight text-balance md:text-5xl">
          Capabilities, not just chat
        </h1>
        <p className="text-muted-foreground max-w-prose text-lg leading-relaxed">{lede}</p>
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
          message="The capability list could not be loaded. Try again in a moment."
          className="min-h-[200px]"
        />
      ) : (
        <>
          <CatalogueSection
            id="experiences"
            eyebrow="Built in"
            title="Experiences"
            lede="Whole workflows with their own surface: research, writing, media, music and code. Switch each one on where you want it."
          >
            {isLoading ? <SkeletonGrid count={6} /> : <ExperienceList experiences={experiences} />}
          </CatalogueSection>
          <CatalogueSection
            id="model-tools"
            eyebrow="Built in"
            title="Model tools"
            lede="Tools a model can call mid-reply, invoked with a slash command or picked up automatically when the task calls for them."
          >
            {isLoading ? <SkeletonGrid count={6} /> : <ModelToolList modelTools={modelTools} />}
          </CatalogueSection>
          <CatalogueSection
            id="tools"
            eyebrow="Built in"
            title="Function tools"
            lede="Everything the assistant can do beyond talking. Some need a Pro plan, some run on your own provider keys, and the rest come with every account."
          >
            {isLoading ? <SkeletonGrid count={9} /> : <ToolList tools={tools} />}
          </CatalogueSection>
          <CatalogueSection
            id="recipes"
            eyebrow="Templates"
            title="Recipes"
            lede="One-tap setups that connect your services and run on a schedule or an event. Install one and it becomes yours to configure."
          >
            {isLoading ? <SkeletonGrid count={6} /> : <RecipeList recipes={recipes} />}
          </CatalogueSection>
          <CatalogueSection
            id="yours"
            eyebrow="Curated by you"
            title="Agents, skills and installed recipes are yours"
            lede="The catalogue ends where your account begins. Nothing here is shared across people; each person or workspace builds its own set."
          >
            <CuratedByYou />
          </CatalogueSection>
        </>
      )}
    </div>
  );
}
