import { handleApiRequest } from "@/lib/api-handler";
import { readUserSession } from "@/lib/session";
import { findUserById } from "@/modules/assessment/assessment.repository";

export async function GET() {
  return handleApiRequest(async () => {
    const session = await readUserSession();
    if (!session) {
      return { authenticated: false as const };
    }

    const user = await findUserById(session.userId);
    return {
      authenticated: true as const,
      name: user?.name ?? undefined,
      phone: user?.phone ?? undefined,
    };
  });
}
