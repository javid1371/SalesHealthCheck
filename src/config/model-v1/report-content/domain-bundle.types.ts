/** Score band for a single answer option (0 = weakest, 3 = strongest). */
export type AnswerScore = 0 | 1 | 2 | 3;

/** Domain maturity level keys used in Report Content Library v1. */
export type DomainLevelKey =
  | "critical"
  | "weak"
  | "average"
  | "healthy"
  | "advanced";

/** Funnel family grouping from the content library. */
export type DomainFamily =
  | "strategy"
  | "acquisition"
  | "nurture"
  | "operations"
  | "conversion"
  | "retention"
  | "experience"
  | "measurement";

export type DomainLevelContent = {
  level_key: DomainLevelKey;
  score_min: number;
  score_max: number;
  /** Often absent in D05–D16 Notion properties; may be derived at seed time. */
  label_fa?: string;
  headline_fa: string;
  interpretation_fa?: string;
};

export type AnswerOptionContent = {
  score: AnswerScore;
  text_fa: string;
  /** Merged from questionsV1 when Notion answer_options_json is empty. */
  option_meaning_fa?: string;
  /** Merged from optionInterpretations when absent in Notion. */
  public_reflection_fa?: string;
};

export type QuestionContent = {
  question_id: string;
  question_number: number;
  /** Merged from questionsV1 when Notion only provides { id, label }. */
  question_text_fa?: string;
  /** Internal — never render to end users. */
  internal_diagnosis_fa?: string;
  public_evidence_label_fa?: string;
  options: AnswerOptionContent[];
};

export type RootCauseContent = {
  root_id: string;
  root_title_fa: string;
  public_root_sentence_fa: string;
  mechanism_fa: string;
  sales_impact_fa: string;
};

export type QuestionRootRule = {
  question_id: string;
  /** Simple expression, e.g. `score<=1`. */
  condition: string;
  root_id: string;
  /** Often absent in D05–D16 Notion properties. */
  evidence_sentence_template_fa?: string;
};

export type ActionContent = {
  action_id: string;
  action_title_fa: string;
  quick_win_summary_fa: string;
  /** Shown only for the quick-win domain in freemium reports. */
  full_action_fa?: string;
  locked_teaser_fa: string;
};

export type DomainBundle = {
  domain_id: string;
  domain_number: number;
  engine_id: string;
  title_fa: string;
  family: DomainFamily;
  role_in_funnel_fa: string;
  public_summary_fa: string;
  /** Internal — never render to end users. */
  internal_diagnosis_summary_fa: string;
  domain_levels: DomainLevelContent[];
  symptoms: string[];
  root_causes: RootCauseContent[];
  questions: QuestionContent[];
  question_root_rules: QuestionRootRule[];
  actions: ActionContent[];
  /** Internal — never render to end users. */
  rendering_rules_fa: string;
};
