import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Eye, MessageSquare, ArrowLeft, Crown, Medal } from "lucide-react";
import { motion } from "framer-motion";
import type { Student } from "@shared/schema";

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function LeaderboardPage() {
  const [sortBy, setSortBy] = useState<"searches" | "feedback">("searches");
  const [, navigate] = useLocation();

  const { data: leaderboard, isLoading } = useQuery<Student[]>({
    queryKey: ["/api/leaderboard", `?sort=${sortBy}&limit=20`],
  });

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-yellow-500/3 rounded-full blur-3xl" />
        <div className="absolute top-60 -left-20 w-[300px] h-[300px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-xl mx-auto px-4 py-4">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="mb-4 text-muted-foreground"
            data-testid="button-back-leaderboard"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </motion.div>

        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 mb-3"
          >
            <Trophy className="w-6 h-6 text-yellow-500" />
          </motion.div>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="text-xs text-muted-foreground mt-1">Most popular profiles</p>
        </motion.div>

        <motion.div
          className="flex items-center justify-center gap-1.5 mb-5 p-1 rounded-xl bg-card/50 border border-white/5 max-w-xs mx-auto"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <button
            onClick={() => setSortBy("searches")}
            data-testid="button-sort-searches"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
              sortBy === "searches"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Searches
          </button>
          <button
            onClick={() => setSortBy("feedback")}
            data-testid="button-sort-feedback"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
              sortBy === "feedback"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Feedback
          </button>
        </motion.div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-xl bg-card/50 p-3.5">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-6 h-6 rounded" />
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : leaderboard && leaderboard.length > 0 ? (
          <div className="space-y-1.5 pb-20">
            {leaderboard.map((student, index) => (
              <motion.div
                key={student.id}
                data-testid={`card-leaderboard-${student.id}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + index * 0.04 }}
                className={`group rounded-xl p-3.5 cursor-pointer transition-all duration-200 hover:bg-card/80 border border-transparent hover:border-white/5 ${
                  index === 0 ? "bg-yellow-500/5" :
                  index === 1 ? "bg-gray-400/5" :
                  index === 2 ? "bg-amber-600/5" :
                  "bg-card/30"
                }`}
                onClick={() => navigate(`/student/${student.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 flex items-center justify-center shrink-0">
                    {index === 0 ? (
                      <Crown className="w-4.5 h-4.5 text-yellow-500" />
                    ) : index === 1 ? (
                      <Medal className="w-4.5 h-4.5 text-gray-400" />
                    ) : index === 2 ? (
                      <Medal className="w-4.5 h-4.5 text-amber-600" />
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground/60">
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <Avatar className="w-10 h-10 ring-2 ring-transparent group-hover:ring-primary/20 transition-all duration-300">
                    <AvatarImage src={student.pictureUrl || undefined} alt={student.name} />
                    <AvatarFallback className="text-xs font-semibold bg-primary/15 text-primary">
                      {getInitials(student.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors duration-200">{student.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-200">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Eye className="w-3 h-3" />
                      {student.searchCount}
                    </span>
                    <span className="text-muted-foreground/30">|</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageSquare className="w-3 h-3" />
                      {student.feedbackCount}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-card/30 p-8 text-center text-muted-foreground">
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No leaderboard data yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
