import { Button, ButtonLink } from "@ngriffin_uk/polychat-component-ui";
import { useUIStore } from "@ngriffin_uk/polychat-library-react";

export function DiscoverWelcome({ isAuthenticated }: { isAuthenticated: boolean }) {
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <p className="max-w-[30rem] text-[0.95rem] leading-relaxed text-muted-foreground">
        {isAuthenticated
          ? "Free accounts chat on their own provider keys or on-device models. Pro adds hosted models, voice, Work and apps."
          : "Talk to every major model, keep what comes of it, and hand bigger jobs to teammates."}
      </p>
      <div className="flex flex-wrap gap-2">
        {isAuthenticated ? (
          <ButtonLink size="sm" variant="primary" href="/profile?tab=providers">
            Add your keys
          </ButtonLink>
        ) : (
          <Button size="sm" variant="primary" onClick={() => setShowLoginModal(true)}>
            Sign in
          </Button>
        )}
        <ButtonLink size="sm" variant="ghost" href="/pricing">
          {isAuthenticated ? "See Pro" : "See plans"}
        </ButtonLink>
      </div>
    </div>
  );
}
