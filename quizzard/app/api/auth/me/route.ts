import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return Response.json({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
