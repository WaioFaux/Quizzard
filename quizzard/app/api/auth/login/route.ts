import { NextRequest } from "next/server";
import { LoginSchema } from "@/lib/validation/schemas";
import { validateCredentials } from "@/lib/services/auth.service";
import { getSession, sessionOptions } from "@/lib/middleware/auth";
import { handleApiError } from "@/lib/utils/error-handler";
import { AuthorizationError, ValidationError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const user = await validateCredentials(
      parsed.data.email,
      parsed.data.password
    );

    if (!user) {
      logger.warn("auth.login_failed", { email: parsed.data.email });
      throw new AuthorizationError("Invalid email or password");
    }

    // Create session
    const session = await getSession();
    session.userId = user.id;
    session.role = user.role;
    await session.save();

    logger.info("auth.login", { userId: user.id, role: user.role });

    return Response.json({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
