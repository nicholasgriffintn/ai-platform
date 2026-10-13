import { HardenedHtmlFrame } from "@ngriffin_uk/polychat-component-content";
import { StrudelPlayer } from "@ngriffin_uk/polychat-component-experiences/music";
import type { BenchmarkArtefact } from "@ngriffin_uk/polychat-schemas";

export function ArtefactView({ artefact, title }: { artefact: BenchmarkArtefact; title: string }) {
  if (artefact.kind === "html") {
    return (
      <div className="aspect-square w-full overflow-hidden rounded-xl border border-border bg-white">
        <HardenedHtmlFrame html={artefact.content} title={title} />
      </div>
    );
  }

  return <StrudelPlayer code={artefact.content} title={title} readOnly />;
}
