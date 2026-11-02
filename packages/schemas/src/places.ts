import z from "zod/v4";

export const placeSchema = z
  .object({
    label: z.string().trim().min(1).max(160),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })
  .strict();

export const placeSearchQuerySchema = z
  .object({ query: z.string().trim().min(2).max(120) })
  .strict();
export const placesResponseSchema = z.object({ places: z.array(placeSchema).max(8) });
export type Place = z.infer<typeof placeSchema>;

export const transitJourneySchema = z.object({
  durationMinutes: z.number().finite().positive().max(1440),
  disruptions: z.array(z.string()).max(100),
});
export type TransitJourney = z.infer<typeof transitJourneySchema>;
