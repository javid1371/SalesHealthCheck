import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

export function assertSalesFunnelEnabled(): void {
  if (!env.salesFunnelEnabled) {
    throw new AppError(
      "sales_funnel_disabled",
      "Sales funnel module is not enabled",
      404,
    );
  }
}
