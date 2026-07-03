import { handleApiRequest } from "@/lib/api-handler";
import { createSalesExpertSession } from "@/lib/session";
import { authenticateStaff } from "@/modules/staff/staff.service";

export async function POST(request: Request) {
  const body = await request.json();
  return handleApiRequest(async () => {
    const staff = await authenticateStaff("sales_expert", body);
    await createSalesExpertSession({
      staffUserId: staff.staffUserId,
      name: staff.name,
    });
    return { ok: true };
  });
}
