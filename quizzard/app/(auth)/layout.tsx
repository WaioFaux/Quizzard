import { getSession } from "@/lib/middleware/auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // Redirect logged-in users to their dashboard
  if (session?.userId) {
    if (session.role === "TEACHER") {
      redirect("/teacher/classes");
    } else {
      redirect("/classes");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      {children}
    </div>
  );
}
