import { handleApiRequest } from "@/lib/api-handler";
import { readUserSession } from "@/lib/session";

export async function GET() {
  return handleApiRequest(async () => {
    const session = await readUserSession();
    return { authenticated: session !== null };
  });
}
