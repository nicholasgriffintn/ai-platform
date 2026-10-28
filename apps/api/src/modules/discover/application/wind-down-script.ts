import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import {
  discoverWindDownDraftSchema,
  discoverWindDownParkDraftSchema,
  type DiscoverWindDownContent,
  type DiscoverWindDownDraft,
} from "@ngriffin_uk/polychat-schemas";
import { humaniseIdentifier } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { describeWindDownMaterial, planWindDownStory } from "~/modules/discover/domain/wind-down";
import { generateSystemObject } from "~/modules/models/application/system-object";

import { readWindDownDay, readWindDownHighlights } from "./wind-down-context";
import { listRecentWindDowns } from "./wind-down-history";

const AVOID_LIMIT = 5;

export interface WindDownScriptRequest {
  aboutToday?: boolean;
  premise?: string;
  notes?: string;
}

export interface WindDownScript extends DiscoverWindDownDraft {
  parked?: string[];
}

export async function writeWindDownScript(
  context: ServiceContext,
  windDownId: string,
  content: DiscoverWindDownContent,
  request: WindDownScriptRequest,
): Promise<WindDownScript> {
  const user = context.requireUser();
  const recent = await listRecentWindDowns(context, user.id, windDownId);
  const avoid = recent.flatMap((session) => (session.summary ? [session.summary] : []));
  const base = {
    kind: content.kind,
    minutes: content.minutes,
    avoid: avoid.slice(0, AVOID_LIMIT),
  };
  const minutes = String(content.minutes);
  const aboutToday = request.aboutToday !== false;

  switch (content.kind) {
    case "story": {
      const plan = planWindDownStory(content.topic ?? null, recent);

      return generateSystemObject(context, {
        role: "writing",
        name: "discover_wind_down_story",
        schema: discoverWindDownDraftSchema,
        system: renderPrompt("discover/wind-down/story", { minutes }),
        material: describeWindDownMaterial({
          ...base,
          day: null,
          story: { ...plan, part: content.part ?? plan.part, premise: request.premise ?? null },
        }),
      });
    }

    case "read_back": {
      const highlights = await readWindDownHighlights(context, user.id);

      if (highlights.length === 0) {
        throw new AssistantError(
          "There are no highlights to read back",
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }

      return generateSystemObject(context, {
        role: "writing",
        name: "discover_wind_down_read_back",
        schema: discoverWindDownDraftSchema,
        system: renderPrompt("discover/wind-down/read-back", { minutes }),
        material: describeWindDownMaterial({ ...base, day: null, highlights }),
      });
    }

    case "park":
      return generateSystemObject(context, {
        role: "writing",
        name: "discover_wind_down_park",
        schema: discoverWindDownParkDraftSchema,
        system: renderPrompt("discover/wind-down/park", { minutes }),
        material: describeWindDownMaterial({
          ...base,
          day: aboutToday ? await readWindDownDay(context, user.id) : null,
          notes: request.notes,
        }),
      });
    default:
      return generateSystemObject(context, {
        role: "writing",
        name: "discover_wind_down",
        schema: discoverWindDownDraftSchema,
        system: renderPrompt("discover/wind-down/script", {
          kind: humaniseIdentifier(content.kind).toLowerCase(),
          minutes,
        }),
        material: describeWindDownMaterial({
          ...base,
          day:
            content.kind === "unwind" && aboutToday
              ? await readWindDownDay(context, user.id)
              : null,
        }),
      });
  }
}
