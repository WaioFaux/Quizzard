import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { AuthorizationError } from "../utils/errors";
import { Role } from "@prisma/client";

export interface SessionData {
  userId: string;
  role: Role;
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

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "complex_password_at_least_32_characters_long",
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
    throw new AuthorizationError("Login required");
  }

  return session as SessionData;
}

export async function requireRole(role: Role) {
  const session = await requireAuth();

  if (session.role !== role) {
    throw new AuthorizationError(`${role.toLowerCase()} access required`);
  }

  return session;
}

export async function requireTeacher() {
  return requireRole(Role.TEACHER);
}

export async function requireStudent() {
  return requireRole(Role.STUDENT);
}
