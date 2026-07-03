import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/lib/api-handler";
import {
  ADMIN_SESSION_COOKIE,
  parseAdminSessionCookie,
} from "@/lib/session";
import { requireAdminSession } from "@/modules/admin/admin.service";
import {
  getAllResolvedSequences,
  getFunnelSettings,
} from "@/modules/sms-funnel/funnel-config.service";
import {
  getSmsFunnelAdminMetrics,
  listRecentSmsMessages,
  listSmsOptOuts,
} from "@/modules/sms-funnel/funnel.repository";

export async function GET(request: NextRequest) {
  return handleApiRequest(async () => {
    const session = parseAdminSessionCookie(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );
    requireAdminSession(session);

    const [sequences, settings, metrics, recentSmsMessages, optOuts] =
      await Promise.all([
        getAllResolvedSequences(),
        getFunnelSettings(),
        getSmsFunnelAdminMetrics(),
        listRecentSmsMessages(20),
        listSmsOptOuts(50),
      ]);

    return {
      sequences,
      settings,
      metrics,
      recentSmsMessages: recentSmsMessages.map((row) => ({
        id: row.id,
        phone: row.phone,
        sequenceKey: row.sequenceKey,
        stepKey: row.stepKey,
        status: row.status,
        scheduledFor: row.scheduledFor.toISOString(),
        sentAt: row.sentAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      optOuts: optOuts.map((row) => ({
        phone: row.phone,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  });
}
