/** DB domain displayOrder (1..16) → internal engine_id (funnel order). */
export const DB_DISPLAY_ORDER_TO_ENGINE_ID: Record<number, number> = {
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
  6: 7,
  7: 8,
  8: 9,
  9: 10,
  10: 11,
  11: 12,
  12: 13,
  13: 14,
  14: 15,
  15: 1,
  16: 16,
};

export const ENGINE_ID_TO_DISPLAY_ORDER: Record<number, number> = Object.fromEntries(
  Object.entries(DB_DISPLAY_ORDER_TO_ENGINE_ID).map(([displayOrder, engineId]) => [
    engineId,
    Number(displayOrder),
  ]),
) as Record<number, number>;

export const ENGINE_ID_TO_SLUG: Record<number, string> = {
  1: "sales-journey-clarity",
  2: "persona",
  3: "uvp",
  4: "offer-design",
  5: "lead-generation",
  6: "lead-nurturing",
  7: "speed-to-lead",
  8: "lead-qualification",
  9: "initial-trust",
  10: "needs-discovery",
  11: "presentation",
  12: "objection-handling",
  13: "closing",
  14: "loyalty",
  15: "touchpoint-consistency",
  16: "measurement-optimization",
};

export const SLUG_TO_ENGINE_ID: Record<string, number> = Object.fromEntries(
  Object.entries(ENGINE_ID_TO_SLUG).map(([engineId, slug]) => [slug, Number(engineId)]),
);

export const ENGINE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const;

export function displayOrderToEngineId(displayOrder: number): number {
  const engineId = DB_DISPLAY_ORDER_TO_ENGINE_ID[displayOrder];
  if (!engineId) {
    throw new Error(`Unknown domain displayOrder: ${displayOrder}`);
  }
  return engineId;
}

export function engineIdToSlug(engineId: number): string {
  const slug = ENGINE_ID_TO_SLUG[engineId];
  if (!slug) {
    throw new Error(`Unknown engine_id: ${engineId}`);
  }
  return slug;
}
