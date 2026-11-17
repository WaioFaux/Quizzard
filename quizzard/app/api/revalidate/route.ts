import { NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const { path, tag } = body as { path?: string; tag?: string };

    if (path) {
      revalidatePath(path);
    }

    if (tag) {
      revalidateTag(tag, "max");
    }

    return Response.json({
      revalidated: true,
      path,
      tag,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to revalidate" },
      { status: 500 }
    );
  }
}
