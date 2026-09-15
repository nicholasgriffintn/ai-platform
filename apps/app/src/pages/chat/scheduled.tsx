import {
  ScheduledLibrary,
  usePersonalCapabilityScope,
} from "@ngriffin_uk/polychat-component-shell";

export function meta() {
  return [{ title: "Scheduled - Polychat" }];
}

export default function ChatScheduledPage() {
  const scope = usePersonalCapabilityScope();

  return (
    <ScheduledLibrary
      scope={scope}
      title="Scheduled"
      subtitle="The automations you have installed, and the schedules and triggers they run on."
    />
  );
}
