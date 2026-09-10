import { NextRequest } from "next/server";
import { SignupSchema, LoginSchema } from "@/lib/validation/schemas";
import { createUser, validateCredentials } from "@/lib/services/auth.service";
import { getSession, sessionOptions } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { ValidationError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const parsed = SignupSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const user = await createUser(parsed.data);

    // Create session
    const session = await getSession();
    session.userId = user.id;
    session.role = user.role;
    session.name = user.name;
    await session.save();

    logger.info("auth.signup", { userId: user.id, role: user.role });

    return Response.json({ data: user }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
