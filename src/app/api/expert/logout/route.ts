import { handleApiRequest } from "@/lib/api-handler";
import { clearSession } from "@/lib/session";

export async function POST() {
  return handleApiRequest(async () => {
    await clearSession("sales_expert");
    return { ok: true };
  });
}
