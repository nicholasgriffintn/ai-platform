import { PageShell } from "~/components/Core/PageShell";
import { PetsPanel } from "~/components/Profile/PetsPanel";

export function ProfilePetsTab() {
  return (
    <div>
      <PageShell.Header title="Your pet" />

      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Your pet perches above the composer in Chat and Work, and reacts to what Polychat is doing.
      </p>

      <PetsPanel />
    </div>
  );
}
