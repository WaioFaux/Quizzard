import { requireAuth } from "@/lib/middleware/auth";
import { redirect } from "next/navigation";
import { StudentSidebar } from "@/components/student-sidebar";
import { prisma } from "@/lib/db";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  if (session.role !== "STUDENT") {
    redirect("/");
  }

  // Fetch user to get avatarUrl
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { avatarUrl: true },
  });

  return (
    <div className="flex h-screen overflow-hidden">
      <StudentSidebar studentName={session.name} avatarUrl={user?.avatarUrl} />
      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-slate-950">
        {children}
      </main>
    </div>
  );
}
