import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import {
  AUTOMATION_HEARTBEAT_KEYS,
  recordAutomationFailure,
  recordAutomationSuccess,
} from "@/modules/admin/automation-heartbeat.service";
import {
  processDueSystemLeadAssignments,
  processStaleAssessmentLeads,
  processUnassignedLeadAssignments,
} from "@/modules/consultation/lead-assignment.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertCronAuth(request);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const key = AUTOMATION_HEARTBEAT_KEYS.leadAssignment;

  try {
    // Keep due + unassigned sequential so the same lead is not raced by both.
    const [staleMoved, assignmentResult] = await Promise.all([
      processStaleAssessmentLeads(),
      (async () => {
        const processed = await processDueSystemLeadAssignments();
        const unassignedAssigned = await processUnassignedLeadAssignments();
        return { processed, unassignedAssigned };
      })(),
    ]);

    await recordAutomationSuccess(key);

    return NextResponse.json({
      processed: assignmentResult.processed,
      staleMoved,
      unassignedAssigned: assignmentResult.unassignedAssigned,
    });
  } catch (error) {
    await recordAutomationFailure(key, error);
    return NextResponse.json(
      { error: "cron_failed", message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
