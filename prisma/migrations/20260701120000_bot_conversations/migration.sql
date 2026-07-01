-- CreateEnum
CREATE TYPE "MessengerPlatform" AS ENUM ('telegram', 'bale');

-- CreateEnum
CREATE TYPE "BotConversationState" AS ENUM ('idle', 'awaiting_contact', 'awaiting_business_name', 'awaiting_team_size', 'awaiting_sales_model', 'answering_questions', 'completed');

-- CreateTable
CREATE TABLE "bot_conversations" (
    "id" TEXT NOT NULL,
    "platform" "MessengerPlatform" NOT NULL,
    "chat_id" TEXT NOT NULL,
    "user_id" TEXT,
    "assessment_id" TEXT,
    "state" "BotConversationState" NOT NULL DEFAULT 'idle',
    "current_domain_index" INTEGER NOT NULL DEFAULT 0,
    "current_question_index" INTEGER NOT NULL DEFAULT 0,
    "last_prompt_message_id" TEXT,
    "contact_first_name" TEXT,
    "business_name" TEXT,
    "team_size" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bot_conversations_platform_chat_id_key" ON "bot_conversations"("platform", "chat_id");
