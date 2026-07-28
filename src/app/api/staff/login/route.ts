import { handleApiRequest } from "@/lib/api-handler";
import { createAdminSession, createSalesExpertSession } from "@/lib/session";
import { authenticateStaffByCredentials } from "@/modules/staff/staff.service";

export async function POST(request: Request) {
  const body = await request.json();
  return handleApiRequest(async () => {
    const staff = await authenticateStaffByCredentials(body);

    if (staff.role === "admin") {
      await createAdminSession({
        staffUserId: staff.staffUserId,
        name: staff.name,
      });
      return {
        ok: true,
        role: staff.role,
        redirectTo: "/admin/dashboard",
      };
    }

    await createSalesExpertSession({
      staffUserId: staff.staffUserId,
      name: staff.name,
    });
    return {
      ok: true,
      role: staff.role,
      redirectTo: "/expert/dashboard",
    };
  });
}
