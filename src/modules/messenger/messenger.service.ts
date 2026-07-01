import type { AssessmentStatus, MessengerPlatform, SalesModel } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { SALES_MODEL_OPTIONS } from "@/lib/sales-model";
import { TEAM_SIZE_OPTIONS } from "@/lib/team-size";
import { findAssessmentsByUserId } from "@/modules/account/account.repository";
import {
  finishAssessment,
  getAssessmentQuestions,
  getAssessmentResult,
  saveAnswers,
  startAssessment,
} from "@/modules/assessment/assessment.service";
import {
  countAnswersForAssessment,
  findAssessmentById,
} from "@/modules/assessment/assessment.repository";
import { createConsultationRequest } from "@/modules/consultation/consultation.repository";
import type { BotClient } from "./bot/bot-client.types";
import { sendLongText } from "./bot/send-long-text";
import { resolveUserFromContactPhone } from "./messenger-auth.service";
import { loadMessengerLabelsByOptionIds } from "./messenger-labels.repository";
import {
  buildBackToMenuRow,
  buildMainMenuRows,
  buildReportSelectionRows,
  isMenuCallback,
  isReportCallback,
  MAIN_MENU_TEXT,
  MENU_CALLBACKS,
  parseReportCallback,
} from "./messenger-menu";
import { formatAssessmentResultForMessenger } from "./messenger-result.formatter";
import {
  findOrCreateConversation,
  resetConversation,
  updateConversation,
} from "./messenger.repository";
import type {
  BotConversationRecord,
  MessengerUpdate,
} from "./messenger.types";
import {
  SALES_MODEL_CALLBACK_PREFIX,
  TEAM_SIZE_CALLBACK_PREFIX,
} from "./messenger.types";

const WELCOME_MESSAGE =
  "به ارزیابی سلامت فروش خوش آمدید.\n\nبرای شروع، لطفاً شماره تماس خود را با دکمه زیر به اشتراک بگذارید.";

const CONTACT_BUTTON_LABEL = "📱 اشتراک شماره تماس";

const ACTIVE_TEST_STATES = new Set([
  "awaiting_business_name",
  "awaiting_team_size",
  "awaiting_sales_model",
  "answering_questions",
]);

function isSalesModel(value: string): value is SalesModel {
  return SALES_MODEL_OPTIONS.some((option) => option.value === value);
}

function isTeamSize(value: string): boolean {
  return TEAM_SIZE_OPTIONS.some((option) => option.value === value);
}

function formatAssessmentListLabel(assessment: {
  id: string;
  status: AssessmentStatus;
  createdAt: Date;
  organization: { businessName: string };
  overallScore: { percentage: number } | null;
}): string {
  const date = new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "short",
  }).format(assessment.createdAt);
  const score = assessment.overallScore
    ? `${Math.round(assessment.overallScore.percentage)}٪`
    : assessment.status === "completed"
      ? "—"
      : "ناتمام";

  const label = `${assessment.organization.businessName} — ${date} — ${score}`;
  return label.length > 60 ? `${label.slice(0, 59)}…` : label;
}

async function findInProgressAssessment(userId: string) {
  const assessments = await findAssessmentsByUserId(userId);
  return (
    assessments.find(
      (assessment) =>
        assessment.status === "in_progress" || assessment.status === "started",
    ) ?? null
  );
}

async function findLatestCompletedAssessment(userId: string) {
  const assessments = await findAssessmentsByUserId(userId);
  return assessments.find((assessment) => assessment.status === "completed") ?? null;
}

async function computeResumePosition(assessmentId: string): Promise<{
  domainIndex: number;
  questionIndex: number;
}> {
  const [questions, answeredCount] = await Promise.all([
    getAssessmentQuestions(assessmentId),
    countAnswersForAssessment(assessmentId),
  ]);

  let remaining = answeredCount;

  for (
    let domainIndex = 0;
    domainIndex < questions.domains.length;
    domainIndex += 1
  ) {
    const domain = questions.domains[domainIndex]!;
    for (
      let questionIndex = 0;
      questionIndex < domain.questions.length;
      questionIndex += 1
    ) {
      if (remaining === 0) {
        return { domainIndex, questionIndex };
      }
      remaining -= 1;
    }
  }

  return {
    domainIndex: questions.domains.length,
    questionIndex: 0,
  };
}

async function sendContactRequest(
  client: BotClient,
  chatId: string,
): Promise<void> {
  await client.sendMessage({
    chatId,
    text: WELCOME_MESSAGE,
    replyMarkup: {
      type: "reply",
      rows: [[{ text: CONTACT_BUTTON_LABEL, requestContact: true }]],
      oneTimeKeyboard: true,
    },
  });
}

async function sendMainMenu(
  client: BotClient,
  conversation: BotConversationRecord,
): Promise<BotConversationRecord> {
  const inProgress = conversation.userId
    ? await findInProgressAssessment(conversation.userId)
    : null;

  await client.sendMessage({
    chatId: conversation.chatId,
    text: MAIN_MENU_TEXT,
    replyMarkup: {
      type: "inline",
      rows: buildMainMenuRows({
        hasInProgressAssessment: Boolean(inProgress),
      }),
    },
  });

  return updateConversation(conversation.id, {
    state: "at_main_menu",
    assessmentId: inProgress?.id ?? conversation.assessmentId,
  });
}

async function sendTeamSizePrompt(
  client: BotClient,
  conversation: BotConversationRecord,
): Promise<void> {
  const sent = await client.sendMessage({
    chatId: conversation.chatId,
    text: "اندازه تیم فروش شما چقدر است؟",
    replyMarkup: {
      type: "inline",
      rows: TEAM_SIZE_OPTIONS.map((option) => [
        {
          text: option.label,
          callbackData: `${TEAM_SIZE_CALLBACK_PREFIX}${option.value}`,
        },
      ]),
    },
  });

  await updateConversation(conversation.id, {
    state: "awaiting_team_size",
    lastPromptMessageId: sent.messageId,
  });
}

async function sendSalesModelPrompt(
  client: BotClient,
  conversation: BotConversationRecord,
): Promise<void> {
  const sent = await client.sendMessage({
    chatId: conversation.chatId,
    text: "مدل فروش اصلی کسب‌وکار شما چیست؟",
    replyMarkup: {
      type: "inline",
      rows: SALES_MODEL_OPTIONS.map((option) => [
        {
          text: option.label,
          callbackData: `${SALES_MODEL_CALLBACK_PREFIX}${option.value}`,
        },
      ]),
    },
  });

  await updateConversation(conversation.id, {
    state: "awaiting_sales_model",
    lastPromptMessageId: sent.messageId,
  });
}

async function startAssessmentFromConversation(
  client: BotClient,
  conversation: BotConversationRecord,
  salesModel: SalesModel,
): Promise<BotConversationRecord> {
  if (!conversation.userId || !conversation.businessName || !conversation.teamSize) {
    throw new Error("missing_conversation_data");
  }

  const userName = conversation.contactFirstName?.trim() || "کاربر";

  const started = await startAssessment(
    {
      user: { name: userName },
      organization: {
        businessName: conversation.businessName,
        teamSize: conversation.teamSize,
        salesModel,
      },
    },
    { userId: conversation.userId },
  );

  await client.sendMessage({
    chatId: conversation.chatId,
    text: "ارزیابی شروع شد. به سوالات با دقت پاسخ دهید.",
    replyMarkup: { type: "remove" },
  });

  const updated = await updateConversation(conversation.id, {
    assessmentId: started.assessmentId,
    state: "answering_questions",
    currentDomainIndex: 0,
    currentQuestionIndex: 0,
    lastPromptMessageId: null,
  });

  await sendCurrentQuestion(client, updated);
  return updated;
}

async function sendCurrentQuestion(
  client: BotClient,
  conversation: BotConversationRecord,
): Promise<void> {
  if (!conversation.assessmentId) {
    throw new Error("missing_assessment_id");
  }

  const questions = await getAssessmentQuestions(conversation.assessmentId);
  const domain = questions.domains[conversation.currentDomainIndex];

  if (!domain) {
    await completeAssessment(client, conversation);
    return;
  }

  const question = domain.questions[conversation.currentQuestionIndex];
  if (!question) {
    await completeAssessment(client, conversation);
    return;
  }

  const totalQuestions = questions.domains.reduce(
    (sum, currentDomain) => sum + currentDomain.questions.length,
    0,
  );
  const answeredBefore = questions.domains
    .slice(0, conversation.currentDomainIndex)
    .reduce((sum, currentDomain) => sum + currentDomain.questions.length, 0);
  const progress = answeredBefore + conversation.currentQuestionIndex + 1;

  const optionLabels = await loadMessengerLabelsByOptionIds(
    question.options.map((option) => option.id),
  );

  const optionLines = question.options
    .map((option) => {
      const label = optionLabels.get(option.id) ?? option.text;
      return `${option.score}) ${option.text}\n   ↳ ${label}`;
    })
    .join("\n\n");

  const prompt = [
    `سوال ${progress} از ${totalQuestions}`,
    `حوزه: ${domain.name}`,
    "",
    question.text,
    "",
    "گزینه‌ها:",
    optionLines,
    "",
    "یکی از دکمه‌های زیر را انتخاب کنید:",
  ].join("\n");

  const sent = await client.sendMessage({
    chatId: conversation.chatId,
    text: prompt,
    replyMarkup: {
      type: "inline",
      rows: question.options.map((option) => [
        {
          text: optionLabels.get(option.id) ?? option.text,
          callbackData: option.id,
        },
      ]),
    },
  });

  await updateConversation(conversation.id, {
    lastPromptMessageId: sent.messageId,
  });
}

async function advanceQuestionIndices(
  conversation: BotConversationRecord,
): Promise<BotConversationRecord> {
  if (!conversation.assessmentId) {
    throw new Error("missing_assessment_id");
  }

  const questions = await getAssessmentQuestions(conversation.assessmentId);
  let domainIndex = conversation.currentDomainIndex;
  let questionIndex = conversation.currentQuestionIndex + 1;

  const currentDomain = questions.domains[domainIndex];
  if (currentDomain && questionIndex >= currentDomain.questions.length) {
    domainIndex += 1;
    questionIndex = 0;
  }

  if (domainIndex >= questions.domains.length) {
    return updateConversation(conversation.id, {
      currentDomainIndex: domainIndex,
      currentQuestionIndex: questionIndex,
    });
  }

  return updateConversation(conversation.id, {
    currentDomainIndex: domainIndex,
    currentQuestionIndex: questionIndex,
  });
}

async function sendAssessmentReportInChat(
  client: BotClient,
  conversation: BotConversationRecord,
  assessmentId: string,
): Promise<void> {
  const assessment = await findAssessmentById(assessmentId);

  if (!assessment) {
    await client.sendMessage({
      chatId: conversation.chatId,
      text: "ارزیابی پیدا نشد.",
      replyMarkup: {
        type: "inline",
        rows: buildBackToMenuRow(),
      },
    });
    return;
  }

  if (conversation.userId && assessment.userId !== conversation.userId) {
    await client.sendMessage({
      chatId: conversation.chatId,
      text: "دسترسی به این گزارش مجاز نیست.",
      replyMarkup: {
        type: "inline",
        rows: buildBackToMenuRow(),
      },
    });
    return;
  }

  if (assessment.status !== "completed") {
    await client.sendMessage({
      chatId: conversation.chatId,
      text: "این ارزیابی هنوز تکمیل نشده است. می‌توانید از منو «ادامه تست ناتمام» را انتخاب کنید.",
      replyMarkup: {
        type: "inline",
        rows: buildBackToMenuRow(),
      },
    });
    return;
  }

  const result = await getAssessmentResult(assessmentId, {
    token: assessment.resultToken,
  });

  const parts = formatAssessmentResultForMessenger(result);
  await sendLongText(client, conversation.chatId, parts);

  await client.sendMessage({
    chatId: conversation.chatId,
    text: "برای بازگشت به منو، دکمه زیر را بزنید.",
    replyMarkup: {
      type: "inline",
      rows: buildBackToMenuRow(),
    },
  });
}

async function completeAssessment(
  client: BotClient,
  conversation: BotConversationRecord,
): Promise<void> {
  if (!conversation.assessmentId) {
    throw new Error("missing_assessment_id");
  }

  await client.sendMessage({
    chatId: conversation.chatId,
    text: "در حال محاسبه نتیجه ارزیابی...",
  });

  await finishAssessment(conversation.assessmentId);
  await sendAssessmentReportInChat(
    client,
    conversation,
    conversation.assessmentId,
  );

  const updated = await updateConversation(conversation.id, {
    state: "at_main_menu",
  });

  await sendMainMenu(client, updated);
}

async function showReportSelection(
  client: BotClient,
  conversation: BotConversationRecord,
): Promise<void> {
  if (!conversation.userId) {
    await sendContactRequest(client, conversation.chatId);
    return;
  }

  const assessments = await findAssessmentsByUserId(conversation.userId);
  const completed = assessments.filter(
    (assessment) => assessment.status === "completed",
  );

  if (completed.length === 0) {
    await client.sendMessage({
      chatId: conversation.chatId,
      text: "هنوز گزارش تکمیل‌شده‌ای ندارید. از «شروع ارزیابی جدید» استفاده کنید.",
      replyMarkup: {
        type: "inline",
        rows: buildBackToMenuRow(),
      },
    });
    await updateConversation(conversation.id, { state: "at_main_menu" });
    return;
  }

  await client.sendMessage({
    chatId: conversation.chatId,
    text: "کدام گزارش را می‌خواهید ببینید؟",
    replyMarkup: {
      type: "inline",
      rows: buildReportSelectionRows(
        completed.map((assessment) => ({
          id: assessment.id,
          label: formatAssessmentListLabel(assessment),
        })),
      ),
    },
  });

  await updateConversation(conversation.id, { state: "selecting_report" });
}

async function sendWebReportLink(
  client: BotClient,
  conversation: BotConversationRecord,
): Promise<void> {
  if (!conversation.userId) {
    await sendContactRequest(client, conversation.chatId);
    return;
  }

  const assessment = await findLatestCompletedAssessment(conversation.userId);

  if (!assessment) {
    await client.sendMessage({
      chatId: conversation.chatId,
      text: "هنوز گزارش تکمیل‌شده‌ای برای نمایش در وب ندارید.",
      replyMarkup: {
        type: "inline",
        rows: buildBackToMenuRow(),
      },
    });
    return;
  }

  const url = `${env.appBaseUrl}/assessment/${assessment.id}/result?token=${encodeURIComponent(assessment.resultToken)}`;

  await client.sendMessage({
    chatId: conversation.chatId,
    text: `🌐 لینک گزارش در وب:\n${url}`,
    replyMarkup: {
      type: "inline",
      rows: buildBackToMenuRow(),
    },
  });
}

async function startConsultationFlow(
  client: BotClient,
  conversation: BotConversationRecord,
): Promise<void> {
  if (!conversation.userId) {
    await sendContactRequest(client, conversation.chatId);
    return;
  }

  await client.sendMessage({
    chatId: conversation.chatId,
    text: "پیام خود را برای درخواست مشاوره بنویسید (اختیاری). برای رد کردن، «-» بفرستید.",
    replyMarkup: { type: "remove" },
  });

  await updateConversation(conversation.id, {
    state: "awaiting_consultation_message",
  });
}

async function submitConsultationRequest(
  client: BotClient,
  conversation: BotConversationRecord,
  messageText: string,
): Promise<void> {
  if (!conversation.userId) {
    await sendContactRequest(client, conversation.chatId);
    return;
  }

  const user = await db.user.findUnique({
    where: { id: conversation.userId },
    select: { phone: true },
  });

  const latestCompleted = await findLatestCompletedAssessment(conversation.userId);
  let reportId: string | undefined;

  if (latestCompleted) {
    const assessmentWithReport = await findAssessmentById(latestCompleted.id);
    reportId = assessmentWithReport?.report?.id;
  }

  const message =
    messageText.trim() === "-" || !messageText.trim()
      ? undefined
      : messageText.trim();

  await createConsultationRequest({
    name: conversation.contactFirstName?.trim() || "کاربر",
    phone: user?.phone ?? undefined,
    message,
    assessmentSessionId: latestCompleted?.id,
    reportId,
  });

  await client.sendMessage({
    chatId: conversation.chatId,
    text: "✅ درخواست مشاوره شما ثبت شد. به زودی با شما تماس می‌گیریم.",
  });

  const updated = await updateConversation(conversation.id, {
    state: "at_main_menu",
  });

  await sendMainMenu(client, updated);
}

async function resumeInProgressAssessment(
  client: BotClient,
  conversation: BotConversationRecord,
): Promise<void> {
  if (!conversation.userId) {
    await sendContactRequest(client, conversation.chatId);
    return;
  }

  const inProgress = await findInProgressAssessment(conversation.userId);

  if (!inProgress) {
    await client.sendMessage({
      chatId: conversation.chatId,
      text: "تست ناتمامی پیدا نشد.",
      replyMarkup: {
        type: "inline",
        rows: buildBackToMenuRow(),
      },
    });
    return;
  }

  const position = await computeResumePosition(inProgress.id);

  const updated = await updateConversation(conversation.id, {
    assessmentId: inProgress.id,
    state: "answering_questions",
    currentDomainIndex: position.domainIndex,
    currentQuestionIndex: position.questionIndex,
    lastPromptMessageId: null,
  });

  const questions = await getAssessmentQuestions(inProgress.id);
  if (position.domainIndex >= questions.domains.length) {
    await completeAssessment(client, updated);
    return;
  }

  await client.sendMessage({
    chatId: conversation.chatId,
    text: "ادامه ارزیابی از همان‌جایی که متوقف شده بود.",
    replyMarkup: { type: "remove" },
  });

  await sendCurrentQuestion(client, updated);
}

async function handleMenuCallback(
  client: BotClient,
  conversation: BotConversationRecord,
  data: string,
  callbackQueryId: string,
  messageId?: string,
): Promise<void> {
  await client.answerCallbackQuery({ callbackQueryId });

  if (messageId) {
    await client.editMessageReplyMarkup({
      chatId: conversation.chatId,
      messageId,
    });
  }

  switch (data) {
    case MENU_CALLBACKS.newAssessment:
      await updateConversation(conversation.id, {
        state: "awaiting_business_name",
        businessName: null,
        teamSize: null,
        assessmentId: null,
        currentDomainIndex: 0,
        currentQuestionIndex: 0,
      });
      await client.sendMessage({
        chatId: conversation.chatId,
        text: "نام کسب‌وکار یا برند خود را بنویسید:",
        replyMarkup: { type: "remove" },
      });
      return;

    case MENU_CALLBACKS.continueAssessment:
      await resumeInProgressAssessment(client, conversation);
      return;

    case MENU_CALLBACKS.reports:
      await showReportSelection(client, conversation);
      return;

    case MENU_CALLBACKS.consult:
      await startConsultationFlow(client, conversation);
      return;

    case MENU_CALLBACKS.web:
      await sendWebReportLink(client, conversation);
      return;

    case MENU_CALLBACKS.back: {
      const updated = await updateConversation(conversation.id, {
        state: "at_main_menu",
      });
      await sendMainMenu(client, updated);
      return;
    }

    default:
      await client.sendMessage({
        chatId: conversation.chatId,
        text: "گزینه نامعتبر است.",
      });
  }
}

async function handleStartCommand(
  client: BotClient,
  platform: MessengerPlatform,
  chatId: string,
  firstName?: string,
): Promise<void> {
  const conversation = await findOrCreateConversation(platform, chatId);

  if (ACTIVE_TEST_STATES.has(conversation.state)) {
    await client.sendMessage({
      chatId,
      text: "یک ارزیابی در جریان دارید. لطفاً مراحل فعلی را ادامه دهید یا پس از اتمام، /start را بفرستید.",
    });
    return;
  }

  if (conversation.userId) {
    if (firstName) {
      await updateConversation(conversation.id, {
        contactFirstName: firstName,
      });
    }

    const reset = await resetConversation(conversation, { preserveUser: true });
    await sendMainMenu(client, reset);
    return;
  }

  await resetConversation(conversation);
  if (firstName) {
    await updateConversation(conversation.id, {
      contactFirstName: firstName,
      state: "awaiting_contact",
    });
  } else {
    await updateConversation(conversation.id, { state: "awaiting_contact" });
  }

  await sendContactRequest(client, chatId);
}

async function handleContact(
  client: BotClient,
  platform: MessengerPlatform,
  update: Extract<MessengerUpdate, { type: "contact" }>,
): Promise<void> {
  const conversation = await findOrCreateConversation(platform, update.chatId);

  if (
    conversation.state !== "awaiting_contact" &&
    conversation.state !== "idle" &&
    conversation.userId
  ) {
    await client.sendMessage({
      chatId: update.chatId,
      text: "شماره تماس قبلاً ثبت شده است. لطفاً از منو استفاده کنید.",
    });
    return;
  }

  try {
    const { userId } = await resolveUserFromContactPhone(update.phone);

    const updated = await updateConversation(conversation.id, {
      userId,
      contactFirstName: update.firstName ?? conversation.contactFirstName,
    });

    await client.sendMessage({
      chatId: update.chatId,
      text: "شماره تماس تأیید شد.",
      replyMarkup: { type: "remove" },
    });

    await sendMainMenu(client, updated);
  } catch {
    await client.sendMessage({
      chatId: update.chatId,
      text: "شماره تماس نامعتبر است. لطفاً دوباره با دکمه اشتراک شماره اقدام کنید.",
    });
    await sendContactRequest(client, update.chatId);
  }
}

async function handleText(
  client: BotClient,
  platform: MessengerPlatform,
  update: Extract<MessengerUpdate, { type: "text" }>,
): Promise<void> {
  const conversation = await findOrCreateConversation(platform, update.chatId);

  if (conversation.state === "awaiting_consultation_message") {
    await submitConsultationRequest(client, conversation, update.text);
    return;
  }

  if (conversation.state === "awaiting_business_name") {
    const businessName = update.text.trim();
    if (!businessName) {
      await client.sendMessage({
        chatId: update.chatId,
        text: "لطفاً نام کسب‌وکار را وارد کنید.",
      });
      return;
    }

    const updated = await updateConversation(conversation.id, {
      businessName,
      contactFirstName: update.firstName ?? conversation.contactFirstName,
    });

    await sendTeamSizePrompt(client, updated);
    return;
  }

  if (
    conversation.state === "idle" ||
    conversation.state === "completed" ||
    conversation.state === "at_main_menu"
  ) {
    if (conversation.userId) {
      await sendMainMenu(client, conversation);
      return;
    }

    await handleStartCommand(
      client,
      platform,
      update.chatId,
      update.firstName,
    );
    return;
  }

  await client.sendMessage({
    chatId: update.chatId,
    text: "لطفاً از دکمه‌ها برای ادامه استفاده کنید.",
  });
}

async function handleCallback(
  client: BotClient,
  conversation: BotConversationRecord,
  update: Extract<MessengerUpdate, { type: "callback" }>,
): Promise<void> {
  const { data, callbackQueryId, messageId } = update;

  if (isMenuCallback(data)) {
    await handleMenuCallback(
      client,
      conversation,
      data,
      callbackQueryId,
      messageId,
    );
    return;
  }

  if (isReportCallback(data)) {
    const assessmentId = parseReportCallback(data);
    await client.answerCallbackQuery({ callbackQueryId });

    if (messageId) {
      await client.editMessageReplyMarkup({
        chatId: conversation.chatId,
        messageId,
      });
    }

    if (!assessmentId) {
      await client.sendMessage({
        chatId: conversation.chatId,
        text: "گزارش نامعتبر است.",
      });
      return;
    }

    await sendAssessmentReportInChat(client, conversation, assessmentId);
    await updateConversation(conversation.id, { state: "at_main_menu" });
    return;
  }

  if (data.startsWith(TEAM_SIZE_CALLBACK_PREFIX)) {
    if (conversation.state !== "awaiting_team_size") {
      await client.answerCallbackQuery({
        callbackQueryId,
        text: "این گزینه دیگر معتبر نیست.",
      });
      return;
    }

    const teamSize = data.slice(TEAM_SIZE_CALLBACK_PREFIX.length);
    if (!isTeamSize(teamSize)) {
      await client.answerCallbackQuery({
        callbackQueryId,
        text: "گزینه نامعتبر است.",
      });
      return;
    }

    await client.answerCallbackQuery({ callbackQueryId });

    if (messageId) {
      await client.editMessageReplyMarkup({
        chatId: conversation.chatId,
        messageId,
      });
    }

    const updated = await updateConversation(conversation.id, {
      teamSize,
    });

    await sendSalesModelPrompt(client, updated);
    return;
  }

  if (data.startsWith(SALES_MODEL_CALLBACK_PREFIX)) {
    if (conversation.state !== "awaiting_sales_model") {
      await client.answerCallbackQuery({
        callbackQueryId,
        text: "این گزینه دیگر معتبر نیست.",
      });
      return;
    }

    const salesModelValue = data.slice(SALES_MODEL_CALLBACK_PREFIX.length);
    if (!isSalesModel(salesModelValue)) {
      await client.answerCallbackQuery({
        callbackQueryId,
        text: "گزینه نامعتبر است.",
      });
      return;
    }

    await client.answerCallbackQuery({ callbackQueryId });

    if (messageId) {
      await client.editMessageReplyMarkup({
        chatId: conversation.chatId,
        messageId,
      });
    }

    await startAssessmentFromConversation(
      client,
      conversation,
      salesModelValue,
    );
    return;
  }

  if (conversation.state !== "answering_questions" || !conversation.assessmentId) {
    await client.answerCallbackQuery({
      callbackQueryId,
      text: "این پاسخ دیگر معتبر نیست.",
    });
    return;
  }

  const questions = await getAssessmentQuestions(conversation.assessmentId);
  const domain = questions.domains[conversation.currentDomainIndex];
  const question = domain?.questions[conversation.currentQuestionIndex];

  if (!domain || !question) {
    await client.answerCallbackQuery({
      callbackQueryId,
      text: "ارزیابی در حال پایان است.",
    });
    await completeAssessment(client, conversation);
    return;
  }

  const selectedOption = question.options.find((option) => option.id === data);
  if (!selectedOption) {
    await client.answerCallbackQuery({
      callbackQueryId,
      text: "گزینه نامعتبر است.",
    });
    return;
  }

  await client.answerCallbackQuery({ callbackQueryId });

  if (messageId) {
    await client.editMessageReplyMarkup({
      chatId: conversation.chatId,
      messageId,
    });
  }

  await saveAnswers(conversation.assessmentId, {
    answers: [
      {
        questionId: question.id,
        selectedOptionId: selectedOption.id,
      },
    ],
  });

  const advanced = await advanceQuestionIndices(conversation);
  const questionsAfter = await getAssessmentQuestions(conversation.assessmentId);

  if (advanced.currentDomainIndex >= questionsAfter.domains.length) {
    await completeAssessment(client, advanced);
    return;
  }

  await sendCurrentQuestion(client, advanced);
}

export async function handleMessengerUpdate(
  update: MessengerUpdate,
  client: BotClient,
  platform: MessengerPlatform,
): Promise<void> {
  if (update.type === "command") {
    if (update.command === "start") {
      await handleStartCommand(
        client,
        platform,
        update.chatId,
        update.firstName,
      );
    }
    return;
  }

  if (update.type === "contact") {
    await handleContact(client, platform, update);
    return;
  }

  if (update.type === "text") {
    await handleText(client, platform, update);
    return;
  }

  const conversation = await findOrCreateConversation(platform, update.chatId);
  await handleCallback(client, conversation, update);
}
