import { Button, WorkbenchCard } from "@ngriffin_uk/polychat-component-ui";
import { useDiscoverFraming, useSource } from "@ngriffin_uk/polychat-library-react";
import { readSourceFraming } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { Scale } from "lucide-react";

import { FramingDetail } from "../../Knowledge/FramingDetail.js";

export function DiscoverFramingCard({
  editionId,
  cardId,
  sourceId,
}: {
  editionId: string;
  cardId: string;
  sourceId: string;
}) {
  const source = useSource(sourceId).data;
  const check = useDiscoverFraming(editionId, cardId);
  const framing = source ? readSourceFraming(source.metadata) : null;

  return (
    <WorkbenchCard title="How it's framed" icon={Scale}>
      {framing ? (
        <FramingDetail framing={framing} />
      ) : (
        <div className="flex flex-col items-start gap-2">
          <p>Slant, tone, sourcing and what the piece leaves out.</p>
          <Button
            variant="outline"
            size="xs"
            isLoading={check.isPending}
            disabled={!source}
            onClick={() => check.mutate()}
          >
            Check the framing
          </Button>
          {check.error ? (
            <p className="text-failure">
              {getErrorMessage(check.error, "Poly couldn't read the framing")}
            </p>
          ) : null}
        </div>
      )}
    </WorkbenchCard>
  );
}
