import { ButtonLink } from "@ngriffin_uk/polychat-component-ui";
import { MessageCircle, Users } from "lucide-react";
import type { ReactNode } from "react";

import { DiscoverBand } from "../DiscoverBand";

function ProductCard({
  icon,
  name,
  summary,
  points,
}: {
  icon: ReactNode;
  name: string;
  summary: string;
  points: string[];
}) {
  return (
    <div className="bg-surface border-border flex flex-col gap-4 rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <span className="bg-selection text-active-work flex h-8 w-8 items-center justify-center rounded-lg">
          {icon}
        </span>
        <span className="font-display text-foreground text-xl font-medium">{name}</span>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">{summary}</p>
      <ul className="text-foreground space-y-2 text-sm">
        {points.map((point) => (
          <li key={point} className="flex gap-2">
            <span aria-hidden className="bg-active-work mt-2 h-1.5 w-1.5 shrink-0 rounded-full" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChatAndWorkBand() {
  return (
    <DiscoverBand
      id="chat-and-work"
      eyebrow="Two rooms, one perch"
      title="Chat, then Work"
      lede="Ask anything of any model on your own. When a question turns into a project, open Work and bring the people in with you."
      actions={
        <>
          <ButtonLink href="/chat">Start a chat</ButtonLink>
          <ButtonLink variant="outline" href="/work">
            See Work
          </ButtonLink>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ProductCard
          icon={<MessageCircle size={16} />}
          name="Chat"
          summary="Personal, quick, and kept. Every conversation stays where you left it."
          points={[
            "Pick a model per message, or leave it to Auto.",
            "Branch a reply and compare the answers side by side.",
            "Sources, notes and saved outputs travel with the thread.",
          ]}
        />
        <ProductCard
          icon={<Users size={16} />}
          name="Work"
          summary="Shared workspaces with projects, tasks and the agents that run them."
          points={[
            "Invite people to a workspace and scope what each project can reach.",
            "Hand a task to an agent and review the run before it lands.",
            "Governance and usage sit beside the work, not in another tab.",
          ]}
        />
      </div>
    </DiscoverBand>
  );
}
