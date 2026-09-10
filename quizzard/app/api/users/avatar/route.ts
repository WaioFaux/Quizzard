import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { ValidationError } from "@/lib/utils/errors";
import { prisma } from "@/lib/db";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

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
        // Delete the old file
        const oldPath = path.join(process.cwd(), "public", user.avatarUrl);
        try {
          await unlink(oldPath);
        } catch {
          // File might not exist, ignore error
        }

        await prisma.user.update({
          where: { id: session.userId },
          data: { avatarUrl: null },
        });
      }

      return NextResponse.json({ data: { avatarUrl: null } });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new ValidationError("Invalid file type. Only JPG, PNG, GIF, and WebP are allowed.");
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      throw new ValidationError("File too large. Maximum size is 2MB.");
    }

    // Create upload directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${session.userId}-${Date.now()}.${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Read file buffer and write to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Get current user to delete old avatar if exists
    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { avatarUrl: true },
    });

    if (currentUser?.avatarUrl) {
      // Delete the old file
      const oldPath = path.join(process.cwd(), "public", currentUser.avatarUrl);
      try {
        await unlink(oldPath);
      } catch {
        // File might not exist, ignore error
      }
    }

    // Update database
    const avatarUrl = `/uploads/avatars/${filename}`;
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
