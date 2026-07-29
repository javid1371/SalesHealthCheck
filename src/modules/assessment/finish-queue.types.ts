export const FINISH_QUEUE_NAME = "assessment-finish";

export interface FinishJobPayload {
  assessmentId: string;
}

/** BullMQ custom job IDs must not contain colons. */
export function toFinishJobId(assessmentId: string): string {
  return `finish-${assessmentId}`;
}

export type FinishJobStatus =
  | "queued"
  | "active"
  | "completed"
  | "failed";
