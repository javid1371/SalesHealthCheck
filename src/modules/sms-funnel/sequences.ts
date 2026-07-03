import type { ScoreBand, ShortLinkPurpose } from "@prisma/client";

export const SEQUENCE_KEYS = {
  start: "seq_start",
  incomplete: "seq_incomplete",
  reportReady: "seq_report_ready",
  nurture: "seq_nurture",
  formAbandon: "seq_form_abandon",
  callScheduled: "seq_call_scheduled",
} as const;

export type SequenceKey = (typeof SEQUENCE_KEYS)[keyof typeof SEQUENCE_KEYS];

export type StepLinkPurpose = ShortLinkPurpose | null;

export interface SequenceStepDefinition {
  stepKey: string;
  delayMs: number;
  body: string;
  linkPurpose: StepLinkPurpose;
  /** Optional score-band overrides keyed by band. */
  bodyByScoreBand?: Partial<Record<ScoreBand, string>>;
  /** Skip this step when guard returns false at schedule time (optional). */
  requiresNoReportView?: boolean;
  requiresNoConsultation?: boolean;
  requiresConsultationStarted?: boolean;
  requiresNoConsultationSubmit?: boolean;
  hasLink?: boolean;
}

export interface SequenceDefinition {
  key: SequenceKey;
  steps: SequenceStepDefinition[];
}

const MS = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
};

export const FUNNEL_SEQUENCES: Record<SequenceKey, SequenceDefinition> = {
  [SEQUENCE_KEYS.start]: {
    key: SEQUENCE_KEYS.start,
    steps: [
      {
        stepKey: "S1-1",
        delayMs: 0,
        linkPurpose: "start",
        body:
          "سلام، تست سلامت سیستم فروش شما آماده است. با پاسخ به چند سوال کوتاه، گلوگاه‌های اصلی مسیر فروش‌تان مشخص می‌شود:",
      },
      {
        stepKey: "S1-2",
        delayMs: 3 * MS.hour,
        linkPurpose: "start",
        body:
          "هنوز گزارش سلامت سیستم فروش شما تکمیل نشده. کمتر از چند دقیقه زمان می‌برد و نشان می‌دهد کجای قیف فروش بیشترین ریزش را دارید:",
      },
      {
        stepKey: "S1-3",
        delayMs: 24 * MS.hour,
        linkPurpose: "start",
        body:
          "اگر می‌خواهید بدانید چرا بخشی از لیدها به مشتری تبدیل نمی‌شوند، تست سلامت سیستم فروش را از اینجا ادامه دهید:",
      },
    ],
  },
  [SEQUENCE_KEYS.incomplete]: {
    key: SEQUENCE_KEYS.incomplete,
    steps: [
      {
        stepKey: "S2-1",
        delayMs: 45 * MS.minute,
        linkPurpose: "continue_assessment",
        body:
          "فقط چند سوال تا آماده شدن گزارش فروش شما باقی مانده. ادامه دهید تا نقاط ضعف و فرصت‌های رشد مشخص شود:",
      },
      {
        stepKey: "S2-2",
        delayMs: 24 * MS.hour,
        linkPurpose: "continue_assessment",
        body:
          "گزارش سلامت سیستم فروش شما نیمه‌کاره مانده. با تکمیل آن می‌بینید کدام بخش فروش بیشترین اثر را روی رشد درآمد دارد:",
      },
      {
        stepKey: "S2-3",
        delayMs: 3 * MS.day,
        linkPurpose: "continue_assessment",
        body:
          "اگر هنوز فرصت نکرده‌اید، لینک ادامه تست فعال است. هر زمان تکمیل کنید، گزارش اختصاصی فروش شما آماده می‌شود:",
      },
    ],
  },
  [SEQUENCE_KEYS.reportReady]: {
    key: SEQUENCE_KEYS.reportReady,
    steps: [
      {
        stepKey: "S3-1",
        delayMs: 0,
        linkPurpose: "result",
        body:
          "گزارش سلامت سیستم فروش شما آماده شد. چند گلوگاه اصلی در مسیر فروش‌تان مشخص شده. مشاهده گزارش:",
        bodyByScoreBand: {
          low: "گزارش شما نشان می‌دهد چند نقطه در قیف فروش می‌تواند باعث ریزش جدی لیدها شود. همین حالا نتیجه را ببینید:",
        },
      },
      {
        stepKey: "S3-2",
        delayMs: 24 * MS.hour,
        linkPurpose: "result",
        requiresNoReportView: true,
        body:
          "گزارش فروش شما آماده است اما هنوز مشاهده نشده. پیشنهاد می‌کنیم قبل از هر تصمیمی برای رشد فروش، این نتیجه را ببینید:",
      },
    ],
  },
  [SEQUENCE_KEYS.nurture]: {
    key: SEQUENCE_KEYS.nurture,
    steps: [
      {
        stepKey: "S4-1",
        delayMs: 2 * MS.hour,
        linkPurpose: "consultation",
        requiresNoConsultation: true,
        body:
          "بر اساس پاسخ‌های شما، چند نقطه قابل بهبود در مسیر فروش مشخص شده. اگر بخواهید، در یک تماس کوتاه بررسی می‌کنیم کدام مورد اولویت بالاتری دارد:",
        bodyByScoreBand: {
          low: "گزارش شما نشان می‌دهد چند نقطه در قیف فروش می‌تواند باعث ریزش جدی لیدها شود. پیشنهاد می‌کنیم در یک تماس کوتاه اولویت‌های اصلاح را مشخص کنیم:",
          medium:
            "وضعیت فروش شما قابل بهبود است و چند فرصت مشخص برای افزایش نرخ تبدیل دیده می‌شود. برای بررسی مسیر بهبود، درخواست تماس ثبت کنید:",
          high: "گزارش شما نشان می‌دهد پایه فروش نسبتا خوبی دارید. حالا مسئله اصلی می‌تواند بهینه‌سازی و مقیاس‌پذیری باشد. برای بررسی فرصت‌های رشد:",
        },
      },
      {
        stepKey: "S4-2",
        delayMs: 24 * MS.hour,
        linkPurpose: "consultation",
        requiresNoConsultation: true,
        body:
          "خیلی از ریزش‌های فروش با اصلاح چند نقطه کلیدی در پیگیری، پیشنهاد یا تبدیل لید بهتر می‌شوند. برای بررسی گزارش خودتان، زمان تماس را انتخاب کنید:",
        bodyByScoreBand: {
          low: "تعویق اصلاح این گلوگاه‌ها معمولا یعنی ادامه ریزش لید و فروش. برای بررسی سریع اولویت‌ها، زمان تماس را انتخاب کنید:",
          medium:
            "با اصلاح چند نقطه کلیدی می‌توانید نرخ تبدیل فروش‌تان را محسوس بالا ببرید. برای تحلیل گزارش، زمان تماس را انتخاب کنید:",
          high: "برای رشد پایدار، قدم بعدی معمولا scale فرایند فروش است. می‌توانیم در یک جلسه کوتاه فرصت‌های رشد گزارش شما را مرور کنیم:",
        },
      },
      {
        stepKey: "S4-3",
        delayMs: 3 * MS.day,
        linkPurpose: "consultation",
        requiresNoConsultation: true,
        body:
          "اگر هدف‌تان افزایش نرخ تبدیل فروش است، می‌توانیم گزارش سلامت سیستم فروش شما را در یک جلسه کوتاه تحلیل کنیم و مسیر اقدام بدهیم:",
      },
      {
        stepKey: "S4-4",
        delayMs: 7 * MS.day,
        linkPurpose: "consultation",
        requiresNoConsultation: true,
        body:
          "اگر الان زمان مناسبی نیست مشکلی نیست. لینک گزارش و درخواست تماس شما فعال می‌ماند و هر زمان آماده بودید می‌توانید اقدام کنید:",
      },
    ],
  },
  [SEQUENCE_KEYS.formAbandon]: {
    key: SEQUENCE_KEYS.formAbandon,
    steps: [
      {
        stepKey: "S5-1",
        delayMs: 45 * MS.minute,
        linkPurpose: "consultation",
        requiresNoConsultationSubmit: true,
        body:
          "درخواست تماس شما هنوز کامل نشده. برای هماهنگی بررسی گزارش فروش‌تان فقط انتخاب زمان باقی مانده:",
      },
      {
        stepKey: "S5-2",
        delayMs: 24 * MS.hour,
        linkPurpose: "consultation",
        requiresNoConsultationSubmit: true,
        body:
          "برای تحلیل گزارش سلامت سیستم فروش شما می‌توانید زمان تماس را از این لینک انتخاب کنید. جلسه کوتاه و متمرکز روی اولویت‌های فروش شماست:",
      },
    ],
  },
  [SEQUENCE_KEYS.callScheduled]: {
    key: SEQUENCE_KEYS.callScheduled,
    steps: [
      {
        stepKey: "S6-1",
        delayMs: 0,
        linkPurpose: null,
        hasLink: false,
        body:
          "درخواست تماس شما ثبت شد. در زمان انتخاب‌شده، گزارش سلامت سیستم فروش‌تان را بررسی می‌کنیم و اولویت‌های بهبود را مشخص می‌کنیم.",
      },
      {
        stepKey: "S6-2",
        delayMs: 24 * MS.hour,
        linkPurpose: null,
        hasLink: false,
        body:
          "یادآوری: فردا زمان بررسی گزارش سلامت سیستم فروش شماست. اگر نکته خاصی مدنظر دارید، آماده داشته باشید.",
      },
      {
        stepKey: "S6-3",
        delayMs: 22 * MS.hour,
        linkPurpose: null,
        hasLink: false,
        body:
          "یادآوری کوتاه: تا ساعتی دیگر تماس بررسی گزارش فروش شما انجام می‌شود.",
      },
      {
        stepKey: "S6-4",
        delayMs: 26 * MS.hour,
        linkPurpose: "consultation",
        body:
          "به نظر می‌رسد تماس امروز انجام نشد. اگر هنوز مایلید گزارش فروش‌تان بررسی شود، می‌توانید زمان جدید انتخاب کنید:",
      },
    ],
  },
};

export function getSequenceDefinition(
  sequenceKey: SequenceKey,
): SequenceDefinition {
  return FUNNEL_SEQUENCES[sequenceKey];
}

export function resolveStepBody(
  step: SequenceStepDefinition,
  scoreBand?: ScoreBand | null,
): string {
  if (scoreBand && step.bodyByScoreBand?.[scoreBand]) {
    return step.bodyByScoreBand[scoreBand]!;
  }
  return step.body;
}

export function stepIncludesLink(step: SequenceStepDefinition): boolean {
  return step.hasLink !== false && step.linkPurpose !== null;
}
