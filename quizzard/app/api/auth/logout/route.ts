import { NextRequest } from "next/server";
import { getSession } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { logger } from "@/lib/utils/logger";

export async function POST(_req: NextRequest) {
  try {
    const session = await getSession();

    if (session?.userId) {
      logger.info("auth.logout", { userId: session.userId });
    }

    session.destroy();

    return new Response(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
