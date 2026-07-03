function runHook(task: () => Promise<void>): void {
  void (async () => {
    const { isFunnelEnabledFromSettings } = await import(
      "./funnel-config.service"
    );
    if (!(await isFunnelEnabledFromSettings())) return;
    await task();
  })().catch((error) => {
    console.error("[sms-funnel] hook failed:", error);
  });
}

export function hookPhoneVerified(userId: string): void {
  runHook(async () => {
    const { onPhoneVerified } = await import("./enrollment.service");
    await onPhoneVerified(userId);
  });
}

export function hookAssessmentStarted(
  userId: string,
  assessmentSessionId: string,
): void {
  runHook(async () => {
    const { onAssessmentStarted } = await import("./enrollment.service");
    await onAssessmentStarted(userId, assessmentSessionId);
  });
}

export function hookAssessmentInProgress(
  userId: string,
  assessmentSessionId: string,
): void {
  runHook(async () => {
    const { onAssessmentInProgress } = await import("./enrollment.service");
    await onAssessmentInProgress(userId, assessmentSessionId);
  });
}

export function hookAssessmentCompleted(input: {
  userId: string;
  assessmentSessionId: string;
  overallScorePercentage: number;
}): void {
  runHook(async () => {
    const { resolveScoreBand } = await import("./score-band");
    const { onAssessmentCompleted } = await import("./enrollment.service");
    await onAssessmentCompleted({
      userId: input.userId,
      assessmentSessionId: input.assessmentSessionId,
      scoreBand: resolveScoreBand(input.overallScorePercentage),
    });
  });
}

export function hookReportViewed(
  userId: string,
  assessmentSessionId: string,
  overallScorePercentage?: number,
): void {
  runHook(async () => {
    const { resolveScoreBand } = await import("./score-band");
    const { onReportViewed } = await import("./enrollment.service");
    await onReportViewed(
      userId,
      assessmentSessionId,
      overallScorePercentage !== undefined
        ? resolveScoreBand(overallScorePercentage)
        : undefined,
    );
  });
}

export function hookConsultationStarted(
  userId: string,
  assessmentSessionId: string,
): void {
  runHook(async () => {
    const { onConsultationStarted } = await import("./enrollment.service");
    await onConsultationStarted(userId, assessmentSessionId);
  });
}

export function hookConsultationSubmitted(
  userId: string,
  assessmentSessionId: string,
): void {
  runHook(async () => {
    const { onConsultationSubmitted } = await import("./enrollment.service");
    await onConsultationSubmitted(userId, assessmentSessionId);
  });
}
