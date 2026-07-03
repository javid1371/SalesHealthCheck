import { handleApiRequest } from "@/lib/api-handler";
import { createAdminSession } from "@/lib/session";
import { authenticateStaff } from "@/modules/staff/staff.service";

export async function POST(request: Request) {
  const body = await request.json();
  return handleApiRequest(async () => {
    const staff = await authenticateStaff("admin", body);
    await createAdminSession({
      staffUserId: staff.staffUserId,
      name: staff.name,
    });
    return { ok: true };
  });
}
