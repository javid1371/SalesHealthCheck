export type AssessmentStatus =
  | "started"
  | "in_progress"
  | "completed"
  | "abandoned";

export type HealthLevel = "critical" | "weak" | "medium" | "healthy";

export interface AssessmentProgress {
  answeredCount: number;
  totalQuestions: number;
  completedDomains: number;
  totalDomains: number;
}
