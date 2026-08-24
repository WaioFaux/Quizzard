import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { getLeaderboard } from "@/lib/services/quiz.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const session = await requireAuth();

    const leaderboard = await getLeaderboard(
      quizId,
      session.userId,
      session.role
    );

    return Response.json({ data: leaderboard });
  } catch (err) {
    return handleApiError(err);
  }
}
