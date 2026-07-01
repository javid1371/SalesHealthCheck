-- AlterEnum
ALTER TYPE "BotConversationState" ADD VALUE 'at_main_menu';
ALTER TYPE "BotConversationState" ADD VALUE 'selecting_report';
ALTER TYPE "BotConversationState" ADD VALUE 'awaiting_consultation_message';

-- AlterTable
ALTER TABLE "question_options" ADD COLUMN "messenger_label" VARCHAR(64);
