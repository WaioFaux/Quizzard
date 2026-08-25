import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    return Response.json({
      data: {
        userId: session.userId,
        role: session.role,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
