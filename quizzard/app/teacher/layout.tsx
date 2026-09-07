import { requireAuth } from "@/lib/middleware/auth";
import { redirect } from "next/navigation";
import { TeacherSidebar } from "@/components/teacher-sidebar";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  if (session.role !== "TEACHER") {
    redirect("/");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <TeacherSidebar teacherName={session.name} />
      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-slate-950">
        {children}
      </main>
    </div>
  );
}
