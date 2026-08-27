import { getSession } from "@/lib/middleware/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function HomePage() {
  const session = await getSession();

  // If logged in, redirect to appropriate dashboard
  if (session?.userId) {
    if (session.role === "TEACHER") {
      redirect("/teacher/classes");
    } else {
      redirect("/student/classes");
    }
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center py-24 px-8 bg-gradient-to-br from-background via-background to-muted">
        <div className="max-w-3xl text-center space-y-8">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
            Quizzard
          </h1>
          <p className="text-xl text-muted-foreground max-w-xl mx-auto">
            AI-powered quiz platform for educators. Upload lecture materials,
            generate questions with AI, and engage students with interactive quizzes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button asChild size="lg">
              <Link href="/signup">Get Started</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="py-16 px-8 bg-card">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">For Teachers</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Upload lecture materials (PDF)</li>
                  <li>Configure quiz settings</li>
                  <li>Preview and approve AI-generated questions</li>
                  <li>Publish and track results</li>
                </ol>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">For Students</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Join a class with a code</li>
                  <li>View available quizzes</li>
                  <li>Take timed quizzes</li>
                  <li>Check results and leaderboard</li>
                </ol>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AI-Powered</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Multiple question types</li>
                  <li>Randomized question pools</li>
                  <li>Shuffled answer order</li>
                  <li>Calculation with dynamic numbers</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
