import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { ValidationError } from "@/lib/utils/errors";
import { prisma } from "@/lib/db";
import {
  MAX_AVATAR_BYTES,
  buildBlobPathname,
  deleteBlob,
  uploadBuffer,
} from "@/lib/storage/blob";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;

    // If no file provided, this is a remove request
    if (!file || file.size === 0) {
      // Remove current avatar
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { avatarUrl: true },
      });

      if (user?.avatarUrl) {
        await deleteBlob(user.avatarUrl);

        await prisma.user.update({
          where: { id: session.userId },
          data: { avatarUrl: null },
        });
      }

      return NextResponse.json({ data: { avatarUrl: null } });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new ValidationError(
        "Loại tệp không hợp lệ. Chỉ cho phép JPG, PNG, GIF và WebP."
      );
    }

    // Validate file size
    if (file.size > MAX_AVATAR_BYTES) {
      throw new ValidationError("Tệp quá lớn. Kích thước tối đa là 2MB.");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to the blob store (avatars are small enough to pass through the
    // serverless request body limit)
    const pathname = buildBlobPathname("avatars", file.name || "avatar");
    const avatarUrl = await uploadBuffer(pathname, buffer, file.type);

    // Get current user to delete old avatar if exists
    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { avatarUrl: true },
    });

    if (currentUser?.avatarUrl) {
      await deleteBlob(currentUser.avatarUrl);
    }

    // Update database
    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: { avatarUrl },
      select: { avatarUrl: true },
    });

    return NextResponse.json({ data: updatedUser });
  } catch (err) {
    return handleApiError(err);
  }
}
