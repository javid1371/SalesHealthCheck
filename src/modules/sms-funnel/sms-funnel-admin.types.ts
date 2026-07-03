import type {
  FunnelSettings,
  ResolvedSequenceForAdmin,
  ResolvedStepForAdmin,
} from "@/modules/sms-funnel/funnel-config.service";
import type { AdminSmsFunnelMetrics } from "@/modules/admin/admin.types";

export interface SmsFunnelAdminData {
  sequences: ResolvedSequenceForAdmin[];
  settings: FunnelSettings;
  metrics: AdminSmsFunnelMetrics;
  recentSmsMessages: Array<{
    id: string;
    phone: string;
    sequenceKey: string;
    stepKey: string;
    status: string;
    scheduledFor: string;
    sentAt: string | null;
    createdAt: string;
  }>;
  optOuts: Array<{
    phone: string;
    createdAt: string;
  }>;
}

export type { ResolvedStepForAdmin, FunnelSettings };
