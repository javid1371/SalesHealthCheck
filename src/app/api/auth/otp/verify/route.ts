import { handleApiRequest } from "@/lib/api-handler";
import { createUserSession } from "@/lib/session";
import { verifyOtp } from "@/modules/auth/auth.service";

export async function POST(request: Request) {
  const body = await request.json();
  return handleApiRequest(async () => {
    const result = await verifyOtp(body);
    await createUserSession(result.userId);
    return result;
  });
}
