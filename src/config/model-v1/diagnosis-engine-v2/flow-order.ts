/** Funnel flow order for binding constraint (engine_id). */
export const BINDING_FLOW_ORDER = [5, 7, 8, 9, 10, 11, 12, 13] as const;

export const ISSUE_FAMILIES = [
  { key: "strategic", label: "استراتژیک", engineIds: [1, 2, 3, 4] },
  { key: "input", label: "ورودی", engineIds: [5, 7] },
  { key: "trust_persuasion", label: "اعتماد و اقناع", engineIds: [6, 9, 10, 11, 12] },
  { key: "conversion", label: "تبدیل", engineIds: [4, 7, 13] },
  { key: "managerial", label: "مدیریتی/سیستمی", engineIds: [8, 15, 16] },
] as const;
