import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Eye, MessageSquare, ArrowLeft, Crown, Medal } from "lucide-react";
import type { Student } from "@shared/schema";

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function getRankIcon(rank: number) {
  if (rank === 0) return <Crown className="w-4 h-4 text-yellow-500" />;
  if (rank === 1) return <Medal className="w-4 h-4 text-gray-400" />;
  if (rank === 2) return <Medal className="w-4 h-4 text-amber-600" />;
  return null;
}

function getRankBg(rank: number) {
  if (rank === 0) return "bg-yellow-500/10 border-yellow-500/20";
  if (rank === 1) return "bg-gray-400/10 border-gray-400/20";
  if (rank === 2) return "bg-amber-600/10 border-amber-600/20";
  return "";
}

export default function LeaderboardPage() {
  const [sortBy, setSortBy] = useState<"searches" | "feedback">("searches");
  const [, navigate] = useLocation();

  const { data: leaderboard, isLoading } = useQuery<Student[]>({
    queryKey: ["/api/leaderboard", `?sort=${sortBy}&limit=20`],
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="mb-4"
          data-testid="button-back-leaderboard"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 text-primary mb-2">
            <Trophy className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Most popular student profiles</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6">
          <Button
            variant={sortBy === "searches" ? "default" : "secondary"}
            size="sm"
            onClick={() => setSortBy("searches")}
            data-testid="button-sort-searches"
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            Most Searched
          </Button>
          <Button
            variant={sortBy === "feedback" ? "default" : "secondary"}
            size="sm"
            onClick={() => setSortBy("feedback")}
            data-testid="button-sort-feedback"
          >
            <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
            Most Feedback
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-6 h-6 rounded-full" />
                  <Skeleton className="w-11 h-11 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : leaderboard && leaderboard.length > 0 ? (
          <div className="space-y-2">
            {leaderboard.map((student, index) => (
              <Card
                key={student.id}
                data-testid={`card-leaderboard-${student.id}`}
                className={`p-4 hover-elevate cursor-pointer transition-colors ${getRankBg(index)}`}
                onClick={() => navigate(`/student/${student.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 flex items-center justify-center shrink-0">
                    {getRankIcon(index) || (
                      <span className="text-sm font-semibold text-muted-foreground">
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <Avatar className="w-11 h-11">
                    <AvatarImage src={student.pictureUrl || undefined} alt={student.name} />
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {getInitials(student.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{student.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      <Eye className="w-3 h-3 mr-1" />
                      {student.searchCount}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <MessageSquare className="w-3 h-3 mr-1" />
                      {student.feedbackCount}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No leaderboard data yet</p>
          </Card>
        )}
      </div>
    </div>
  );
}
