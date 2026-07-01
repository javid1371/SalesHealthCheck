import type { HealthLevel } from "@/types/assessment";
import type { MessengerPlatform, SalesModel } from "@prisma/client";
import { env } from "@/lib/env";
import { healthLevelLabelFa } from "@/lib/health-level";
import { SALES_MODEL_OPTIONS } from "@/lib/sales-model";
import { TEAM_SIZE_OPTIONS } from "@/lib/team-size";
import {
  finishAssessment,
  getAssessmentQuestions,
  getAssessmentResult,
  saveAnswers,
  startAssessment,
} from "@/modules/assessment/assessment.service";
import { findAssessmentById } from "@/modules/assessment/assessment.repository";
import type { BotClient } from "./bot/bot-client.types";
import { resolveUserFromContactPhone } from "./messenger-auth.service";
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

function isSalesModel(value: string): value is SalesModel {
  return SALES_MODEL_OPTIONS.some((option) => option.value === value);
}

function isTeamSize(value: string): boolean {
  return TEAM_SIZE_OPTIONS.some((option) => option.value === value);
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

  const prompt = [
    `سوال ${progress} از ${totalQuestions}`,
    `حوزه: ${domain.name}`,
    "",
    question.text,
  ].join("\n");

  const sent = await client.sendMessage({
    chatId: conversation.chatId,
    text: prompt,
    replyMarkup: {
      type: "inline",
      rows: question.options.map((option) => [
        {
          text: option.text,
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

  const finished = await finishAssessment(conversation.assessmentId);
  const assessment = await findAssessmentById(conversation.assessmentId);

  if (!assessment) {
    throw new Error("assessment_not_found");
  }

  const result = await getAssessmentResult(conversation.assessmentId, {
    token: assessment.resultToken,
  });

  const bottlenecks = result.bottlenecks
    .slice(0, 3)
    .map(
      (item, index) =>
        `${index + 1}. ${item.domainName} (اولویت ${item.rank})`,
    )
    .join("\n");

  const fullReportUrl = `${env.appBaseUrl}${finished.resultUrl}`;

  const summary = [
    "✅ ارزیابی شما تکمیل شد.",
    "",
    `امتیاز کلی: ${Math.round(result.overallScore.percentage)}٪`,
    `وضعیت: ${healthLevelLabelFa(result.overallScore.healthLevel as HealthLevel)}`,
    "",
    bottlenecks ? `گلوگاه‌های اصلی:\n${bottlenecks}` : "",
    "",
    `📄 گزارش کامل:\n${fullReportUrl}`,
    "",
    "برای شروع ارزیابی جدید، /start را بفرستید.",
  ]
    .filter(Boolean)
    .join("\n");

  await client.sendMessage({
    chatId: conversation.chatId,
    text: summary,
  });

  await updateConversation(conversation.id, {
    state: "completed",
  });
}

async function handleStartCommand(
  client: BotClient,
  platform: MessengerPlatform,
  chatId: string,
  firstName?: string,
): Promise<void> {
  const conversation = await findOrCreateConversation(platform, chatId);

  if (conversation.state !== "idle" && conversation.state !== "completed") {
    await client.sendMessage({
      chatId,
      text: "یک ارزیابی در جریان دارید. لطفاً مراحل فعلی را ادامه دهید یا پس از اتمام، /start را بفرستید.",
    });
    return;
  }

  const reset = await resetConversation(conversation);
  if (firstName) {
    await updateConversation(reset.id, {
      contactFirstName: firstName,
      state: "awaiting_contact",
    });
  } else {
    await updateConversation(reset.id, { state: "awaiting_contact" });
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
    conversation.state !== "idle"
  ) {
    await client.sendMessage({
      chatId: update.chatId,
      text: "شماره تماس قبلاً ثبت شده است. لطفاً مراحل بعدی را ادامه دهید.",
    });
    return;
  }

  try {
    const { userId } = await resolveUserFromContactPhone(update.phone);

    await updateConversation(conversation.id, {
      userId,
      contactFirstName: update.firstName ?? conversation.contactFirstName,
      state: "awaiting_business_name",
    });

    await client.sendMessage({
      chatId: update.chatId,
      text: "نام کسب‌وکار یا برند خود را بنویسید:",
      replyMarkup: { type: "remove" },
    });
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

  if (conversation.state === "idle" || conversation.state === "completed") {
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

    const started = await startAssessmentFromConversation(
      client,
      conversation,
      salesModelValue,
    );

    void started;
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
