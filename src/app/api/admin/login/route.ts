import { handleApiRequest } from "@/lib/api-handler";
import { createAdminSession } from "@/lib/session";
import { verifyAdminPassword } from "@/modules/admin/admin.service";

export async function POST(request: Request) {
  const body = await request.json();
  return handleApiRequest(async () => {
    verifyAdminPassword(body);
    await createAdminSession();
    return { ok: true };
  });
}
