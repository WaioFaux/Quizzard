import { requireAuth } from "@/lib/middleware/auth";
import { redirect } from "next/navigation";

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
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold">Quizzard</h1>
          <p className="text-sm text-muted-foreground">Student Dashboard</p>
        </div>
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            <li>
              <a
                href="/classes"
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-sm font-medium transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                </svg>
                My Classes
              </a>
            </li>
            <li>
              <a
                href="/leaderboard"
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-sm font-medium transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 21h8" />
                  <path d="M12 17v4" />
                  <path d="M7 4h10" />
                  <path d="M17 4v8a5 5 0 0 1-10 0V4" />
                  <path d="M5 9h14" />
                </svg>
                Leaderboard
              </a>
            </li>
          </ul>
        </nav>
        <div className="p-4 border-t">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-destructive/10 text-sm font-medium text-destructive transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Logout
            </button>
          </form>
        </div>
      </aside>
      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
