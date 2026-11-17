import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { ValidationError, AuthorizationError } from "@/lib/utils/errors";
import { ChangePasswordSchema } from "@/lib/validation/schemas";
import { verifyPassword, updatePassword } from "@/lib/services/auth.service";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    // Get user to verify current password
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new AuthorizationError("Không tìm thấy người dùng");
    }

    // Verify current password
    const isValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new AuthorizationError("Mật khẩu hiện tại không đúng");
    }

    // Update to new password
    await updatePassword(session.userId, parsed.data.newPassword);

    return Response.json({
      data: { success: true },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
