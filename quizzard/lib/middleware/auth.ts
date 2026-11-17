import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { AuthorizationError } from "../utils/errors";
import { Role } from "@prisma/client";

export interface SessionData {
  userId: string;
  role: Role;
  name: string;
}

export interface SessionOptions {
  password: string;
  cookieName: string;
  cookieOptions: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax" | "strict" | "none";
    maxAge: number;
    path: string;
  };
}

function _getSessionPassword(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET environment variable is not set. " +
      "Vui lòng đặt thành một chuỗi ngẫu nhiên an toàn dài ít nhất 32 ký tự trong tệp .env của bạn."
    );
  }
  return secret;
}

export const sessionOptions: SessionOptions = {
  password: _getSessionPassword(),
  cookieName: "quizzard_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: "/",
  },
};

export async function getSession() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  return session;
}

export async function requireAuth() {
  const session = await getSession();

  if (!session?.userId) {
    throw new AuthorizationError("Cần đăng nhập");
  }

  return session as SessionData;
}

export async function requireRole(role: Role) {
  const session = await requireAuth();

  if (session.role !== role) {
    throw new AuthorizationError(
      role === Role.TEACHER
        ? "Chỉ giáo viên mới có quyền truy cập"
        : "Chỉ học sinh mới có quyền truy cập"
    );
  }

  return session;
}

export async function requireTeacher() {
  return requireRole(Role.TEACHER);
}

export async function requireStudent() {
  return requireRole(Role.STUDENT);
}
