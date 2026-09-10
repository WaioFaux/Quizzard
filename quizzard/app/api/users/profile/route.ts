import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { ValidationError, ConflictError } from "@/lib/utils/errors";
import { UpdateProfileSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/middleware/auth";

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    // Check if email is already taken by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        email: parsed.data.email,
        NOT: { id: session.userId },
      },
    });

    if (existingUser) {
      throw new ConflictError("Email already in use");
    }

    const user = await prisma.user.update({
      where: { id: session.userId },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    // Update session name
    const dbSession = await getSession();
    dbSession.name = user.name;
    await dbSession.save();

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
