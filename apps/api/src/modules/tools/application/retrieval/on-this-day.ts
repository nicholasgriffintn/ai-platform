import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

const ON_THIS_DAY_URL = "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected";

const onThisDayResponseSchema = z.object({
  selected: z
    .array(
      z.object({
        text: z.string().min(1),
        year: z.number().int().optional(),
        pages: z
          .array(
            z.object({
              content_urls: z
                .object({ desktop: z.object({ page: z.string() }).optional() })
                .optional(),
            }),
          )
          .optional(),
      }),
    )
    .default([]),
});

export interface OnThisDayEvent {
  year: number | null;
  text: string;
  url: string | null;
}

export async function retrieveOnThisDay(date: string, count: number): Promise<OnThisDayEvent[]> {
  const [, month, day] = date.split("-");
  const response = await fetch(`${ON_THIS_DAY_URL}/${month}/${day}`, {
    headers: { accept: "application/json", "user-agent": "Polychat (polychat.app)" },
  });

  if (!response.ok) {
    throw new AssistantError(
      `Wikipedia's On this day feed returned ${response.status}`,
      ErrorType.PROVIDER_ERROR,
    );
  }

  const parsed = onThisDayResponseSchema.parse(await response.json());

  return parsed.selected.slice(0, count).map((event) => ({
    year: event.year ?? null,
    text: event.text,
    url: event.pages?.[0]?.content_urls?.desktop?.page ?? null,
  }));
}
