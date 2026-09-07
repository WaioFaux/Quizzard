import { requireAuth } from "@/lib/middleware/auth";
import { redirect } from "next/navigation";
import { StudentSidebar } from "@/components/student-sidebar";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  if (session.role !== "STUDENT") {
    redirect("/");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <StudentSidebar studentName={session.name} />
      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-slate-950">
        {children}
      </main>
    </div>
  );
}
