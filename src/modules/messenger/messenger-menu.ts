import type { InlineButton } from "./bot/bot-client.types";

export const MENU_CALLBACK_PREFIX = "menu:";
export const REPORT_CALLBACK_PREFIX = "report:";

export const MENU_CALLBACKS = {
  newAssessment: `${MENU_CALLBACK_PREFIX}new`,
  continueAssessment: `${MENU_CALLBACK_PREFIX}continue`,
  reports: `${MENU_CALLBACK_PREFIX}reports`,
  consult: `${MENU_CALLBACK_PREFIX}consult`,
  web: `${MENU_CALLBACK_PREFIX}web`,
  back: `${MENU_CALLBACK_PREFIX}back`,
} as const;

export const MAIN_MENU_TEXT =
  "منوی اصلی — یکی از گزینه‌های زیر را انتخاب کنید:";

export function buildMainMenuRows(options: {
  hasInProgressAssessment: boolean;
}): InlineButton[][] {
  const rows: InlineButton[][] = [
    [{ text: "🆕 شروع ارزیابی جدید", callbackData: MENU_CALLBACKS.newAssessment }],
  ];

  if (options.hasInProgressAssessment) {
    rows.push([
      {
        text: "▶️ ادامه تست ناتمام",
        callbackData: MENU_CALLBACKS.continueAssessment,
      },
    ]);
  }

  rows.push(
    [{ text: "📊 گزارش و نتایج من", callbackData: MENU_CALLBACKS.reports }],
    [{ text: "📞 درخواست مشاوره", callbackData: MENU_CALLBACKS.consult }],
    [{ text: "🌐 مشاهده در وب", callbackData: MENU_CALLBACKS.web }],
  );

  return rows;
}

export function buildReportSelectionRows(
  assessments: Array<{
    id: string;
    label: string;
  }>,
): InlineButton[][] {
  const rows = assessments.map((assessment) => [
    {
      text: assessment.label,
      callbackData: `${REPORT_CALLBACK_PREFIX}${assessment.id}`,
    },
  ]);

  rows.push([
    {
      text: "↩️ بازگشت به منو",
      callbackData: MENU_CALLBACKS.back,
    },
  ]);

  return rows;
}

export function buildBackToMenuRow(): InlineButton[][] {
  return [[{ text: "↩️ بازگشت به منو", callbackData: MENU_CALLBACKS.back }]];
}

export function isMenuCallback(data: string): boolean {
  return data.startsWith(MENU_CALLBACK_PREFIX);
}

export function isReportCallback(data: string): boolean {
  return data.startsWith(REPORT_CALLBACK_PREFIX);
}

export function parseReportCallback(data: string): string | null {
  if (!isReportCallback(data)) {
    return null;
  }

  const assessmentId = data.slice(REPORT_CALLBACK_PREFIX.length).trim();
  return assessmentId || null;
}
