import { handleApiRequest } from "@/lib/api-handler";
import { createSalesExpertSession } from "@/lib/session";
import { verifySalesExpertPassword } from "@/modules/consultation/consultation.service";

export async function POST(request: Request) {
  const body = await request.json();
  return handleApiRequest(async () => {
    verifySalesExpertPassword(body);
    await createSalesExpertSession();
    return { ok: true };
  });
}
