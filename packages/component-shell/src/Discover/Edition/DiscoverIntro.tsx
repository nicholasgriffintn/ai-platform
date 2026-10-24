import { Button } from "@ngriffin_uk/polychat-component-ui";
import { Sunrise } from "lucide-react";

export function DiscoverIntro({
  isWorking,
  onTurnOn,
}: {
  isWorking: boolean;
  onTurnOn: () => void;
}) {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-start gap-5 py-10">
      <Sunrise size={28} className="text-active-work" aria-hidden />
      <h2 className="font-display text-4xl font-medium tracking-tight text-balance text-foreground">
        A morning edition, made for you
      </h2>
      <p className="text-lg leading-relaxed text-muted-foreground">
        Each morning Poly looks at what you've been talking about and leaves an edition here: a
        brief, topics worth a look, links, automations worth setting up and things to do next.
      </p>
      <Button variant="primary" disabled={isWorking} onClick={onTurnOn}>
        {isWorking ? "Setting up your first edition" : "Turn on Discover"}
      </Button>
    </section>
  );
}
