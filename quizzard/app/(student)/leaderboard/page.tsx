import { Skeleton } from "@/components/ui/skeleton";

export default function LeaderboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Leaderboard</h1>
      <Skeleton className="h-64" />
    </div>
  );
}
