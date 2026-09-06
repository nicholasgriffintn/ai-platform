import { Button, ButtonLink } from "@ngriffin_uk/polychat-component-ui";
import { KeyRound, Lock, Wallet } from "lucide-react";
import type { ReactNode } from "react";

import { useAuthStatus } from "~/hooks/useAuth";
import { useUIStore } from "~/state/stores/uiStore";

import { DiscoverBand } from "../DiscoverBand";

const POINTS: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <KeyRound size={18} />,
    title: "Your provider keys",
    body: "Add keys for the providers you already pay, and model usage on them costs no credits.",
  },
  {
    icon: <Wallet size={18} />,
    title: "Infrastructure still counts",
    body: "Sandbox runs, agents and storage draw from the monthly pot whichever keys you bring.",
  },
  {
    icon: <Lock size={18} />,
    title: "Kept where you can see them",
    body: "Keys are stored encrypted, scoped to your account, and removable from Providers at any time.",
  },
];

export function KeysBand() {
  const { isAuthenticated } = useAuthStatus();
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);

  return (
    <DiscoverBand
      id="keys"
      eyebrow="Bring your own"
      title="Your keys, your models"
      lede="Polychat is one place to use the providers you already have, not another bill on top of them."
      actions={
        isAuthenticated ? (
          <ButtonLink href="/profile?tab=providers">Manage providers</ButtonLink>
        ) : (
          <>
            <Button type="button" variant="primary" onClick={() => setShowLoginModal(true)}>
              Sign in to add keys
            </Button>
            <ButtonLink variant="outline" href="/pricing">
              See pricing
            </ButtonLink>
          </>
        )
      }
    >
      <ul className="grid gap-3">
        {POINTS.map((point) => (
          <li
            key={point.title}
            className="bg-surface border-border flex gap-3 rounded-xl border p-4"
          >
            <span className="bg-selection text-active-work flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              {point.icon}
            </span>
            <span className="min-w-0">
              <span className="text-foreground block text-sm font-medium">{point.title}</span>
              <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">
                {point.body}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </DiscoverBand>
  );
}
